import { Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CatalogBundle } from '../catalog-bundle';
import { CatalogReport, SectionReport, emptyReport } from '../catalog-report';
import { uniqueKey } from '../catalog-key.util';

export interface ImportInput {
  restaurantId: string;
  targetBranchId: string;
  bundle: CatalogBundle;
  mode: 'DRY_RUN' | 'APPLY';
  /** Default OVERWRITE. */
  conflictStrategy?: 'SKIP' | 'OVERWRITE';
}

/** Sentinel prefix for ids assigned to would-create records during DRY_RUN. */
const DRY = '__dry__';

/**
 * Thrown to abort an APPLY transaction on a fatal missing reference so Prisma
 * rolls everything back. Carries the partially-built report so the caller can
 * still return it with ok:false.
 */
class FatalImportError extends Error {
  constructor(public readonly report: CatalogReport) {
    super('CATALOG_IMPORT_FATAL');
  }
}

/**
 * Engine that applies a {@link CatalogBundle} into a target branch (BR-6).
 *
 * Dependency order: inventoryCategories → suppliers → inventoryItems →
 * processes → menuCategories → menuItems(+modifiers) → recipes.
 *
 * Reference resolution per record: keys are resolved against (records already in
 * the target branch) ∪ (records created earlier in THIS import), via per-section
 * in-memory key→id maps. A reference to a key absent from BOTH the bundle and the
 * target branch is a record-level error; that record is NOT written.
 *
 * Conflict handling: not-found-by-key → CREATE; found → SKIP (leave) or OVERWRITE
 * (update to match) per strategy.
 *
 * DRY_RUN opens no transaction and writes nothing; it seeds `__dry__` sentinel
 * ids so later references still resolve. APPLY runs the entire import in one
 * prisma.$transaction; any fatal missing reference throws → full rollback.
 *
 * Operational data (stock layers/movements, receipts, adjustments, write-offs,
 * runs, orders, tables, reservations, KDS) is NEVER touched.
 */
@Injectable()
export class CatalogImportService {
  constructor(private readonly prisma: PrismaService) {}

  async import(input: ImportInput): Promise<CatalogReport> {
    const strategy = input.conflictStrategy ?? 'OVERWRITE';
    const report = emptyReport(input.mode, strategy);

    if (input.mode === 'DRY_RUN') {
      // No transaction, no writes — a read-only client suffices.
      await this.run(this.prisma, input, strategy, report, true);
      return report;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.run(tx, input, strategy, report, false);
      });
    } catch (err) {
      if (err instanceof FatalImportError) {
        err.report.ok = false;
        return err.report;
      }
      throw err;
    }
    return report;
  }

  // ── Orchestration (shared by DRY_RUN + APPLY) ──────────────────────────────

  private async run(
    db: Prisma.TransactionClient | PrismaService,
    input: ImportInput,
    strategy: 'SKIP' | 'OVERWRITE',
    report: CatalogReport,
    dryRun: boolean,
  ): Promise<void> {
    const { restaurantId, targetBranchId, bundle } = input;
    const { sections } = bundle;

    // Per-section key→id maps. Seeded from the target branch, then extended with
    // records created during this import.
    const invCategoryIdByKey = new Map<string, string>();
    const invItemIdByKey = new Map<string, string>();
    const menuCategoryIdByKey = new Map<string, string>();
    const menuItemIdByKey = new Map<string, string>();

    const newId = () => (dryRun ? `${DRY}:${createId()}` : createId());

    // ── inventoryCategories ────────────────────────────────────────────────
    await this.seedInventoryCategories(db, restaurantId, targetBranchId, invCategoryIdByKey);
    for (const c of sections.inventoryCategories) {
      const r = report.sections.inventoryCategories;
      const existingId = invCategoryIdByKey.get(c.key);
      if (existingId && !existingId.startsWith(DRY)) {
        if (strategy === 'SKIP') {
          r.skipped += 1;
          continue;
        }
        if (!dryRun) {
          await db.inventoryCategory.update({ where: { id: existingId }, data: { name: c.name } });
        }
        r.updated += 1;
      } else {
        const id = newId();
        if (!dryRun) {
          await db.inventoryCategory.create({
            data: { id, restaurantId, branchId: targetBranchId, name: c.name },
          });
        }
        invCategoryIdByKey.set(c.key, id);
        r.created += 1;
      }
    }

    // ── suppliers ───────────────────────────────────────────────────────────
    const supplierIdByKey = new Map<string, string>();
    await this.seedSuppliers(db, restaurantId, targetBranchId, supplierIdByKey);
    for (const s of sections.suppliers) {
      const r = report.sections.suppliers;
      const existingId = supplierIdByKey.get(s.key);
      if (existingId && !existingId.startsWith(DRY)) {
        if (strategy === 'SKIP') {
          r.skipped += 1;
          continue;
        }
        if (!dryRun) {
          await db.supplier.update({
            where: { id: existingId },
            data: { name: s.name, contact: s.contact, note: s.note },
          });
        }
        r.updated += 1;
      } else {
        const id = newId();
        if (!dryRun) {
          await db.supplier.create({
            data: {
              id,
              restaurantId,
              branchId: targetBranchId,
              name: s.name,
              contact: s.contact,
              note: s.note,
            },
          });
        }
        supplierIdByKey.set(s.key, id);
        r.created += 1;
      }
    }

    // ── inventoryItems ──────────────────────────────────────────────────────
    await this.seedInventoryItems(db, restaurantId, targetBranchId, invItemIdByKey);
    for (const it of sections.inventoryItems) {
      const r = report.sections.inventoryItems;
      const categoryId = this.resolveOptionalRef(
        it.categoryKey,
        invCategoryIdByKey,
        r,
        it.key,
        'category',
      );
      if (categoryId === REF_ERROR) {
        if (!dryRun) throw new FatalImportError(report);
        continue;
      }
      const data = {
        name: it.name,
        sku: it.sku,
        categoryId: categoryId,
        kind: it.kind,
        baseUnit: it.baseUnit,
        alternateUnits: it.alternateUnits.map((a) => ({ name: a.name, factor: a.factor })),
        trackExpiry: it.trackExpiry,
        lowStockThresholdBase: it.lowStockThresholdBase,
      };
      const existingId = invItemIdByKey.get(it.key);
      if (existingId && !existingId.startsWith(DRY)) {
        if (strategy === 'SKIP') {
          r.skipped += 1;
          continue;
        }
        if (!dryRun) {
          await db.inventoryItem.update({ where: { id: existingId }, data });
        }
        r.updated += 1;
      } else {
        const id = newId();
        if (!dryRun) {
          await db.inventoryItem.create({
            data: { id, restaurantId, branchId: targetBranchId, ...data },
          });
        }
        invItemIdByKey.set(it.key, id);
        r.created += 1;
      }
    }

    // ── processes ─────────────────────────────────────────────────────────────
    const processIdByKey = new Map<string, string>();
    await this.seedProcesses(db, restaurantId, targetBranchId, processIdByKey);
    for (const p of sections.processes) {
      const r = report.sections.processes;
      // Resolve all item refs first; any missing → record-level error, skip write.
      const inputs: Array<{ itemId: string; baseQty: number }> = [];
      const outputs: Array<{
        itemId: string;
        baseQty: number;
        isPrimary: boolean;
        costShareBps: number | null;
      }> = [];
      let refFailed = false;
      for (const i of p.inputs) {
        const itemId = this.resolveRequiredRef(i.itemKey, invItemIdByKey, r, p.key, 'input item');
        if (itemId === REF_ERROR) {
          refFailed = true;
          break;
        }
        inputs.push({ itemId, baseQty: i.baseQty });
      }
      if (!refFailed) {
        for (const o of p.outputs) {
          const itemId = this.resolveRequiredRef(
            o.itemKey,
            invItemIdByKey,
            r,
            p.key,
            'output item',
          );
          if (itemId === REF_ERROR) {
            refFailed = true;
            break;
          }
          outputs.push({
            itemId,
            baseQty: o.baseQty,
            isPrimary: o.isPrimary,
            costShareBps: o.costShareBps,
          });
        }
      }
      if (refFailed) {
        if (!dryRun) throw new FatalImportError(report);
        continue;
      }

      const header = {
        name: p.name,
        processingCostAmount: p.processingCostAmount,
        note: p.note,
      };
      const existingId = processIdByKey.get(p.key);
      if (existingId && !existingId.startsWith(DRY)) {
        if (strategy === 'SKIP') {
          r.skipped += 1;
          continue;
        }
        if (!dryRun) {
          await db.process.update({ where: { id: existingId }, data: header });
          // Full replace of children (matches inventory process update semantics).
          await db.processInput.deleteMany({ where: { processId: existingId } });
          await db.processOutput.deleteMany({ where: { processId: existingId } });
          await db.processInput.createMany({
            data: inputs.map((i) => ({
              id: createId(),
              processId: existingId,
              branchId: targetBranchId,
              itemId: i.itemId,
              baseQty: i.baseQty,
            })),
          });
          await db.processOutput.createMany({
            data: outputs.map((o) => ({
              id: createId(),
              processId: existingId,
              branchId: targetBranchId,
              itemId: o.itemId,
              baseQty: o.baseQty,
              isPrimary: o.isPrimary,
              costShareBps: o.costShareBps,
            })),
          });
        }
        r.updated += 1;
      } else {
        const id = newId();
        if (!dryRun) {
          await db.process.create({
            data: { id, restaurantId, branchId: targetBranchId, ...header },
          });
          await db.processInput.createMany({
            data: inputs.map((i) => ({
              id: createId(),
              processId: id,
              branchId: targetBranchId,
              itemId: i.itemId,
              baseQty: i.baseQty,
            })),
          });
          await db.processOutput.createMany({
            data: outputs.map((o) => ({
              id: createId(),
              processId: id,
              branchId: targetBranchId,
              itemId: o.itemId,
              baseQty: o.baseQty,
              isPrimary: o.isPrimary,
              costShareBps: o.costShareBps,
            })),
          });
        }
        processIdByKey.set(p.key, id);
        r.created += 1;
      }
    }

    // ── menuCategories ────────────────────────────────────────────────────────
    await this.seedMenuCategories(db, restaurantId, targetBranchId, menuCategoryIdByKey);
    for (const c of sections.menuCategories) {
      const r = report.sections.menuCategories;
      const existingId = menuCategoryIdByKey.get(c.key);
      const data = { name: c.name, description: c.description, displayOrder: c.displayOrder };
      if (existingId && !existingId.startsWith(DRY)) {
        if (strategy === 'SKIP') {
          r.skipped += 1;
          continue;
        }
        if (!dryRun) {
          await db.menuCategory.update({ where: { id: existingId }, data });
        }
        r.updated += 1;
      } else {
        const id = newId();
        if (!dryRun) {
          await db.menuCategory.create({
            data: { id, restaurantId, branchId: targetBranchId, code: c.key, ...data },
          });
        }
        menuCategoryIdByKey.set(c.key, id);
        r.created += 1;
      }
    }

    // ── menuItems (+ modifier groups + options) ────────────────────────────────
    await this.seedMenuItems(db, restaurantId, targetBranchId, menuItemIdByKey);
    for (const it of sections.menuItems) {
      const r = report.sections.menuItems;
      const categoryId = this.resolveRequiredRef(
        it.categoryKey,
        menuCategoryIdByKey,
        r,
        it.key,
        'category',
      );
      if (categoryId === REF_ERROR) {
        if (!dryRun) throw new FatalImportError(report);
        continue;
      }
      const data = {
        categoryId,
        name: it.name,
        description: it.description,
        priceAmount: it.priceAmount,
        preparationStation: it.prepStation,
        prepTimeMinutes: it.prepTimeMinutes,
        status: it.status,
        availability: it.availability,
      };
      const existingId = menuItemIdByKey.get(it.key);
      let itemId: string;
      if (existingId && !existingId.startsWith(DRY)) {
        if (strategy === 'SKIP') {
          r.skipped += 1;
          continue;
        }
        itemId = existingId;
        if (!dryRun) {
          await db.menuItem.update({ where: { id: existingId }, data });
        }
        r.updated += 1;
      } else {
        itemId = newId();
        if (!dryRun) {
          await db.menuItem.create({
            data: { id: itemId, restaurantId, branchId: targetBranchId, code: it.key, ...data },
          });
        }
        menuItemIdByKey.set(it.key, itemId);
        r.created += 1;
      }

      // Reconcile modifier groups/options for this item (CREATE + OVERWRITE).
      await this.reconcileModifiers(
        db,
        restaurantId,
        targetBranchId,
        itemId,
        it.modifierGroups,
        dryRun,
        newId,
      );
    }

    // ── recipes ─────────────────────────────────────────────────────────────
    for (const rc of sections.recipes) {
      const r = report.sections.recipes;
      const menuItemId = this.resolveRequiredRef(
        rc.menuItemKey,
        menuItemIdByKey,
        r,
        rc.menuItemKey,
        'menu item',
      );
      if (menuItemId === REF_ERROR) {
        if (!dryRun) throw new FatalImportError(report);
        continue;
      }

      // Resolve line + modifier-consumption refs.
      const lines: Array<{ itemId: string; baseQty: number }> = [];
      let refFailed = false;
      for (const l of rc.lines) {
        const itemId = this.resolveRequiredRef(
          l.itemKey,
          invItemIdByKey,
          r,
          rc.menuItemKey,
          'recipe line item',
        );
        if (itemId === REF_ERROR) {
          refFailed = true;
          break;
        }
        lines.push({ itemId, baseQty: l.baseQty });
      }

      // modifierConsumptions need the option id, which we look up from the item's
      // persisted groups/options by (groupKey, optionKey). Built lazily.
      const modConsumptions: Array<{ modifierOptionId: string; itemId: string; baseQty: number }> =
        [];
      if (!refFailed && rc.modifierConsumptions.length) {
        const optionIdByGroupOption = dryRun
          ? new Map<string, string>() // sentinel-only; we cannot resolve real ids in dry-run
          : await this.loadOptionIdMap(db, restaurantId, targetBranchId, menuItemId);
        for (const m of rc.modifierConsumptions) {
          const itemId = this.resolveRequiredRef(
            m.itemKey,
            invItemIdByKey,
            r,
            rc.menuItemKey,
            'modifier consumption item',
          );
          if (itemId === REF_ERROR) {
            refFailed = true;
            break;
          }
          const optKey = `${m.groupKey}::${m.optionKey}`;
          const optionId = dryRun ? `${DRY}:${optKey}` : optionIdByGroupOption.get(optKey);
          if (!optionId) {
            r.errors.push({
              key: rc.menuItemKey,
              message: `modifier option not found for group "${m.groupKey}" option "${m.optionKey}".`,
            });
            refFailed = true;
            break;
          }
          modConsumptions.push({ modifierOptionId: optionId, itemId, baseQty: m.baseQty });
        }
      }

      if (refFailed) {
        if (!dryRun) throw new FatalImportError(report);
        continue;
      }

      const existing = dryRun
        ? null
        : await db.recipe.findFirst({
            where: { restaurantId, branchId: targetBranchId, menuItemId, deletedAt: null },
          });

      if (existing) {
        if (strategy === 'SKIP') {
          r.skipped += 1;
          continue;
        }
        if (!dryRun) {
          await db.recipe.update({ where: { id: existing.id }, data: { note: rc.note } });
          await db.recipeLine.deleteMany({ where: { recipeId: existing.id } });
          await db.modifierConsumption.deleteMany({ where: { recipeId: existing.id } });
          await this.insertRecipeChildren(
            db,
            existing.id,
            restaurantId,
            targetBranchId,
            lines,
            modConsumptions,
          );
        }
        r.updated += 1;
      } else {
        const id = newId();
        if (!dryRun) {
          await db.recipe.create({
            data: { id, restaurantId, branchId: targetBranchId, menuItemId, note: rc.note },
          });
          await this.insertRecipeChildren(
            db,
            id,
            restaurantId,
            targetBranchId,
            lines,
            modConsumptions,
          );
        }
        r.created += 1;
      }
    }
  }

  // ── Reference resolution helpers ───────────────────────────────────────────

  /** Resolve a required key→id; record an error + return REF_ERROR if absent. */
  private resolveRequiredRef(
    key: string,
    map: Map<string, string>,
    section: SectionReport,
    recordKey: string,
    label: string,
  ): string {
    const id = map.get(key);
    if (!id) {
      section.errors.push({
        key: recordKey,
        message: `unresolved ${label} reference "${key}" (not in bundle or target branch).`,
      });
      return REF_ERROR;
    }
    return id;
  }

  /** Resolve an optional key→id; null when key is null, REF_ERROR when missing. */
  private resolveOptionalRef(
    key: string | null,
    map: Map<string, string>,
    section: SectionReport,
    recordKey: string,
    label: string,
  ): string | null | typeof REF_ERROR {
    if (key === null || key === undefined) return null;
    const id = map.get(key);
    if (!id) {
      section.errors.push({
        key: recordKey,
        message: `unresolved ${label} reference "${key}" (not in bundle or target branch).`,
      });
      return REF_ERROR;
    }
    return id;
  }

  // ── Modifier reconciliation (OVERWRITE upserts present, soft-deletes absent) ──

  private async reconcileModifiers(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    menuItemId: string,
    groups: CatalogBundle['sections']['menuItems'][number]['modifierGroups'],
    dryRun: boolean,
    newId: () => string,
  ): Promise<void> {
    // Existing groups/options for this item (skip entirely in dry-run for a
    // would-create item whose id is a sentinel).
    // Prompt 1A: groups are reusable + attached via dish_modifier_groups. Import
    // keeps the bundle's per-dish model: each bundle group maps to a group ATTACHED
    // to this dish (matched by name among the dish's current attachments). The group
    // `displayOrder` from the bundle drives the attachment's sortOrder. NOTE: a group
    // absent from the bundle is detached AND soft-deleted (OVERWRITE semantics,
    // unchanged) — safe because import-created groups are item-private.
    const existingLinks =
      dryRun || menuItemId.startsWith(DRY)
        ? []
        : await db.dishModifierGroup.findMany({
            where: { menuItemId, modifierGroup: { deletedAt: null } },
            include: { modifierGroup: { include: { options: { where: { deletedAt: null } } } } },
          });

    const existingLinkByGroupName = new Map(existingLinks.map((l) => [l.modifierGroup.name, l]));
    const now = new Date();

    const keepGroupIds = new Set<string>();
    for (const g of groups) {
      const existingLink = existingLinkByGroupName.get(g.name);
      let groupId: string;
      if (existingLink) {
        groupId = existingLink.modifierGroup.id;
        keepGroupIds.add(groupId);
        if (!dryRun) {
          await db.modifierGroup.update({
            where: { id: groupId },
            data: {
              selectionType: g.selectionType,
              required: g.required,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
            },
          });
          await db.dishModifierGroup.update({
            where: { id: existingLink.id },
            data: { sortOrder: g.displayOrder },
          });
        }
      } else {
        groupId = newId();
        if (!dryRun) {
          await db.modifierGroup.create({
            data: {
              id: groupId,
              restaurantId,
              branchId,
              name: g.name,
              selectionType: g.selectionType,
              required: g.required,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
            },
          });
          await db.dishModifierGroup.create({
            data: {
              id: newId(),
              restaurantId,
              branchId,
              menuItemId,
              modifierGroupId: groupId,
              sortOrder: g.displayOrder,
            },
          });
        }
      }

      // Reconcile options within the group.
      const existingOptions = existingLink ? existingLink.modifierGroup.options : [];
      const existingOptionByName = new Map(existingOptions.map((o) => [o.name, o]));
      const keepOptionIds = new Set<string>();
      for (const o of g.options) {
        const exOpt = existingOptionByName.get(o.name);
        if (exOpt) {
          keepOptionIds.add(exOpt.id);
          if (!dryRun) {
            await db.modifierOption.update({
              where: { id: exOpt.id },
              data: { priceDeltaAmount: o.priceDeltaAmount, sortOrder: o.displayOrder },
            });
          }
        } else if (!dryRun) {
          await db.modifierOption.create({
            data: {
              id: newId(),
              restaurantId,
              branchId,
              modifierGroupId: groupId,
              name: o.name,
              priceDeltaAmount: o.priceDeltaAmount,
              sortOrder: o.displayOrder,
            },
          });
        }
      }
      // Soft-delete options present in the target but absent from the bundle.
      if (!dryRun && existingOptions.length) {
        const removeIds = existingOptions.filter((o) => !keepOptionIds.has(o.id)).map((o) => o.id);
        if (removeIds.length) {
          await db.modifierOption.updateMany({
            where: { id: { in: removeIds } },
            data: { deletedAt: now },
          });
        }
      }
    }

    // Detach + soft-delete groups present on the dish but absent from the bundle.
    if (!dryRun && existingLinks.length) {
      const removeLinks = existingLinks.filter((l) => !keepGroupIds.has(l.modifierGroup.id));
      const removeGroupIds = removeLinks.map((l) => l.modifierGroup.id);
      if (removeGroupIds.length) {
        await db.dishModifierGroup.deleteMany({
          where: { id: { in: removeLinks.map((l) => l.id) } },
        });
        await db.modifierGroup.updateMany({
          where: { id: { in: removeGroupIds } },
          data: { deletedAt: now },
        });
        await db.modifierOption.updateMany({
          where: { modifierGroupId: { in: removeGroupIds } },
          data: { deletedAt: now },
        });
      }
    }
  }

  private async loadOptionIdMap(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    menuItemId: string,
  ): Promise<Map<string, string>> {
    // Prompt 1A: read the dish's attached groups via the join, in attachment order.
    const links = await db.dishModifierGroup.findMany({
      where: { menuItemId, restaurantId, branchId, modifierGroup: { deletedAt: null } },
      orderBy: { sortOrder: 'asc' },
      include: {
        modifierGroup: {
          include: { options: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    const map = new Map<string, string>();
    // Mirror the export's key derivation: slug(name) with -2/-3 collision
    // suffixes, applied in the same ASC order export emits modifier rows.
    const usedGroupKeys = new Set<string>();
    for (const link of links) {
      const g = link.modifierGroup;
      const gKey = uniqueKey(slugLocal(g.name), usedGroupKeys);
      usedGroupKeys.add(gKey);
      const usedOptionKeys = new Set<string>();
      for (const o of g.options) {
        const oKey = uniqueKey(slugLocal(o.name), usedOptionKeys);
        usedOptionKeys.add(oKey);
        map.set(`${gKey}::${oKey}`, o.id);
      }
    }
    return map;
  }

  private async insertRecipeChildren(
    db: Prisma.TransactionClient | PrismaService,
    recipeId: string,
    restaurantId: string,
    branchId: string,
    lines: Array<{ itemId: string; baseQty: number }>,
    modConsumptions: Array<{ modifierOptionId: string; itemId: string; baseQty: number }>,
  ): Promise<void> {
    if (lines.length) {
      await db.recipeLine.createMany({
        data: lines.map((l) => ({
          id: createId(),
          recipeId,
          branchId,
          itemId: l.itemId,
          baseQty: l.baseQty,
        })),
      });
    }
    if (modConsumptions.length) {
      await db.modifierConsumption.createMany({
        data: modConsumptions.map((m) => ({
          id: createId(),
          restaurantId,
          branchId,
          recipeId,
          modifierOptionId: m.modifierOptionId,
          itemId: m.itemId,
          baseQty: m.baseQty,
        })),
      });
    }
  }

  // ── Target-branch seeding (build key→id maps from existing records) ─────────

  private async seedInventoryCategories(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    map: Map<string, string>,
  ): Promise<void> {
    const rows = await db.inventoryCategory.findMany({
      where: { restaurantId, branchId, deletedAt: null },
    });
    for (const c of rows) map.set(slugLocal(c.name), c.id);
  }

  private async seedSuppliers(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    map: Map<string, string>,
  ): Promise<void> {
    const rows = await db.supplier.findMany({ where: { restaurantId, branchId, deletedAt: null } });
    for (const s of rows) map.set(slugLocal(s.name), s.id);
  }

  private async seedInventoryItems(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    map: Map<string, string>,
  ): Promise<void> {
    const rows = await db.inventoryItem.findMany({
      where: { restaurantId, branchId, deletedAt: null },
    });
    for (const it of rows) {
      const key = it.sku && it.sku.trim() ? it.sku : slugLocal(it.name);
      map.set(key, it.id);
    }
  }

  private async seedProcesses(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    map: Map<string, string>,
  ): Promise<void> {
    const rows = await db.process.findMany({ where: { restaurantId, branchId, deletedAt: null } });
    for (const p of rows) map.set(slugLocal(p.name), p.id);
  }

  private async seedMenuCategories(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    map: Map<string, string>,
  ): Promise<void> {
    const rows = await db.menuCategory.findMany({
      where: { restaurantId, branchId, deletedAt: null },
    });
    for (const c of rows) map.set(c.code, c.id);
  }

  private async seedMenuItems(
    db: Prisma.TransactionClient | PrismaService,
    restaurantId: string,
    branchId: string,
    map: Map<string, string>,
  ): Promise<void> {
    const rows = await db.menuItem.findMany({ where: { restaurantId, branchId, deletedAt: null } });
    for (const it of rows) map.set(it.code, it.id);
  }
}

/**
 * Sentinel returned by ref resolvers when a key cannot be resolved. A string (not
 * a symbol) so it interops with the `string` id type; the value is impossible for
 * a real cuid id to collide with.
 */
const REF_ERROR = '__catalog_ref_error__';

/** Local slug (duplicate of catalog-key.util slug to keep this file self-contained for seeding). */
function slugLocal(name: string): string {
  const s = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'item';
}
