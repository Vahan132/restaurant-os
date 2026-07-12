import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { InventoryBaseUnit, ItemKind } from '../../../inventory/domain/enums';
import {
  ItemAvailability,
  MenuStatus,
  ModifierSelectionType,
  PreparationStation,
} from '../../../menu/domain/enums';
import {
  ALL_CATALOG_SECTIONS,
  BundleAlternateUnit,
  CATALOG_BUNDLE_VERSION,
  CATALOG_SCHEMA_VERSION,
  CatalogBundle,
  CatalogSection,
  emptySections,
} from '../catalog-bundle';
import {
  inventoryCategoryKey,
  inventoryItemKey,
  menuCategoryKey,
  menuItemKey,
  modifierGroupKey,
  modifierOptionKey,
  processKey,
  slug,
  supplierKey,
  uniqueKey,
} from '../catalog-key.util';

export interface ExportInput {
  restaurantId: string;
  branchId: string;
  /** Sections to include; defaults to all. */
  include?: CatalogSection[];
}

type AltJson = { name: string; factor: number };

/**
 * Builds a portable {@link CatalogBundle} for a single branch. Every cuid-based
 * cross-reference is resolved to a stable key via in-memory cuid→key maps built
 * from the records we load. The bundle never contains a cuid.
 *
 * Reads are scoped to (restaurantId, branchId, deletedAt:null). Operational data
 * (stock, receipts, movements, runs, orders) is never read.
 */
@Injectable()
export class CatalogExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(input: ExportInput): Promise<CatalogBundle> {
    const { restaurantId, branchId } = input;
    const include = new Set<CatalogSection>(
      input.include?.length ? input.include : ALL_CATALOG_SECTIONS,
    );

    const sections = emptySections();

    // Cross-reference resolution maps (cuid → stable key).
    const invItemKeyById = new Map<string, string>();
    const invCategoryKeyById = new Map<string, string>();
    const menuCategoryKeyById = new Map<string, string>();
    const menuItemKeyById = new Map<string, string>();
    // modifier resolution for recipe modifierConsumptions: optionId → {groupKey, optionKey}
    const optionRefById = new Map<string, { groupKey: string; optionKey: string }>();

    const wantInventory = include.has('inventory');
    const wantProcesses = include.has('processes');
    const wantMenu = include.has('menu');
    const wantRecipes = include.has('recipes');

    // Inventory items + categories must be loaded whenever any section that
    // references them by key is requested (processes/recipes reference items).
    const needInventoryItems = wantInventory || wantProcesses || wantRecipes;
    const needMenuCategories = wantMenu;
    const needMenuItems = wantMenu || wantRecipes;

    // ── Inventory categories ──────────────────────────────────────────────────
    if (wantInventory || needInventoryItems) {
      const cats = await this.prisma.inventoryCategory.findMany({
        where: { restaurantId, branchId, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      const usedCatKeys = new Set<string>();
      for (const c of cats) {
        const key = uniqueKey(inventoryCategoryKey(c), usedCatKeys);
        usedCatKeys.add(key);
        invCategoryKeyById.set(c.id, key);
        if (wantInventory) sections.inventoryCategories.push({ key, name: c.name });
      }
    }

    // ── Suppliers ─────────────────────────────────────────────────────────────
    if (wantInventory) {
      const suppliers = await this.prisma.supplier.findMany({
        where: { restaurantId, branchId, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      const usedSupplierKeys = new Set<string>();
      for (const s of suppliers) {
        const key = uniqueKey(supplierKey(s), usedSupplierKeys);
        usedSupplierKeys.add(key);
        sections.suppliers.push({ key, name: s.name, contact: s.contact, note: s.note });
      }
    }

    // ── Inventory items ───────────────────────────────────────────────────────
    if (needInventoryItems) {
      const items = await this.prisma.inventoryItem.findMany({
        where: { restaurantId, branchId, deletedAt: null },
        orderBy: { name: 'asc' },
      });
      const usedItemKeys = new Set<string>();
      for (const it of items) {
        const key = uniqueKey(inventoryItemKey(it), usedItemKeys);
        usedItemKeys.add(key);
        invItemKeyById.set(it.id, key);
        if (wantInventory) {
          const alternates: BundleAlternateUnit[] = Array.isArray(it.alternateUnits)
            ? (it.alternateUnits as unknown as AltJson[]).map((a) => ({
                name: a.name,
                factor: a.factor,
              }))
            : [];
          sections.inventoryItems.push({
            key,
            // NOTE (PLATCAT-ADOPT-1B): adopted items carry name = null (platform-owned,
            // resolved live). The bundle has no catalog-reference field yet, so a null
            // name degrades to '' — proper representation is an export/import ticket.
            name: it.name ?? '',
            sku: it.sku,
            categoryKey: it.categoryId ? (invCategoryKeyById.get(it.categoryId) ?? null) : null,
            kind: it.kind as ItemKind,
            baseUnit: it.baseUnit as InventoryBaseUnit,
            alternateUnits: alternates,
            trackExpiry: it.trackExpiry,
            lowStockThresholdBase: it.lowStockThresholdBase,
          });
        }
      }
    }

    // ── Processes ─────────────────────────────────────────────────────────────
    if (wantProcesses) {
      const processes = await this.prisma.process.findMany({
        where: { restaurantId, branchId, deletedAt: null },
        include: { inputs: true, outputs: true },
        orderBy: { name: 'asc' },
      });
      const usedProcessKeys = new Set<string>();
      for (const p of processes) {
        const key = uniqueKey(processKey(p), usedProcessKeys);
        usedProcessKeys.add(key);
        sections.processes.push({
          key,
          name: p.name,
          processingCostAmount: p.processingCostAmount,
          note: p.note,
          inputs: p.inputs
            .filter((i) => invItemKeyById.has(i.itemId))
            .map((i) => ({ itemKey: invItemKeyById.get(i.itemId) as string, baseQty: i.baseQty })),
          outputs: p.outputs
            .filter((o) => invItemKeyById.has(o.itemId))
            .map((o) => ({
              itemKey: invItemKeyById.get(o.itemId) as string,
              baseQty: o.baseQty,
              isPrimary: o.isPrimary,
              costShareBps: o.costShareBps,
            })),
        });
      }
    }

    // ── Menu categories ───────────────────────────────────────────────────────
    if (needMenuCategories) {
      const cats = await this.prisma.menuCategory.findMany({
        where: { restaurantId, branchId, deletedAt: null },
        orderBy: { displayOrder: 'asc' },
      });
      for (const c of cats) {
        const key = menuCategoryKey(c);
        menuCategoryKeyById.set(c.id, key);
        if (wantMenu) {
          sections.menuCategories.push({
            key,
            name: c.name,
            description: c.description,
            displayOrder: c.displayOrder,
          });
        }
      }
    }

    // ── Menu items (+ modifier groups + options) ──────────────────────────────
    if (needMenuItems) {
      // Prompt 1A: a dish's groups come via the dish_modifier_groups join (in
      // attachment order). The bundle still nests each group under its dish, so a
      // shared group is exported once per attached dish (no cross-dish dedupe).
      const items = await this.prisma.menuItem.findMany({
        where: { restaurantId, branchId, deletedAt: null },
        include: {
          modifierGroupLinks: {
            where: { modifierGroup: { deletedAt: null } },
            orderBy: { sortOrder: 'asc' },
            include: {
              modifierGroup: {
                include: {
                  options: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
                },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      });
      for (const it of items) {
        const key = menuItemKey(it);
        menuItemKeyById.set(it.id, key);

        // Build group/option key maps for this item (needed by recipes too).
        const usedGroupKeys = new Set<string>();
        const groups = it.modifierGroupLinks.map((link) => {
          const g = link.modifierGroup;
          const gKey = uniqueKey(modifierGroupKey(g), usedGroupKeys);
          usedGroupKeys.add(gKey);
          const usedOptionKeys = new Set<string>();
          const options = g.options.map((o) => {
            const oKey = uniqueKey(modifierOptionKey(o), usedOptionKeys);
            usedOptionKeys.add(oKey);
            optionRefById.set(o.id, { groupKey: gKey, optionKey: oKey });
            return {
              key: oKey,
              name: o.name,
              priceDeltaAmount: o.priceDeltaAmount,
              // Bundle `displayOrder` keeps its name for format stability; sourced
              // from the option's sortOrder.
              displayOrder: o.sortOrder,
            };
          });
          return {
            key: gKey,
            name: g.name,
            selectionType: g.selectionType as ModifierSelectionType,
            required: g.required,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            // Group order within a dish is the attachment's sortOrder.
            displayOrder: link.sortOrder,
            options,
          };
        });

        if (wantMenu) {
          sections.menuItems.push({
            key,
            categoryKey: menuCategoryKeyById.get(it.categoryId) ?? slug(it.name),
            name: it.name,
            description: it.description,
            priceAmount: it.priceAmount,
            prepStation: it.preparationStation as PreparationStation,
            prepTimeMinutes: it.prepTimeMinutes,
            status: it.status as MenuStatus,
            availability: it.availability as ItemAvailability,
            modifierGroups: groups,
          });
        }
      }
    }

    // ── Recipes ───────────────────────────────────────────────────────────────
    if (wantRecipes) {
      const recipes = await this.prisma.recipe.findMany({
        where: { restaurantId, branchId, deletedAt: null },
        include: { lines: true, modifierConsumptions: true },
      });
      for (const r of recipes) {
        const menuKey = menuItemKeyById.get(r.menuItemId);
        if (!menuKey) continue; // recipe's menu item not in scope; skip
        sections.recipes.push({
          menuItemKey: menuKey,
          note: r.note,
          lines: r.lines
            .filter((l) => invItemKeyById.has(l.itemId))
            .map((l) => ({ itemKey: invItemKeyById.get(l.itemId) as string, baseQty: l.baseQty })),
          modifierConsumptions: r.modifierConsumptions
            .filter((m) => optionRefById.has(m.modifierOptionId) && invItemKeyById.has(m.itemId))
            .map((m) => {
              const ref = optionRefById.get(m.modifierOptionId) as {
                groupKey: string;
                optionKey: string;
              };
              return {
                groupKey: ref.groupKey,
                optionKey: ref.optionKey,
                itemKey: invItemKeyById.get(m.itemId) as string,
                baseQty: m.baseQty,
              };
            }),
        });
      }
    }

    return {
      version: CATALOG_BUNDLE_VERSION,
      schemaVersion: CATALOG_SCHEMA_VERSION,
      source: { restaurantId, branchId, exportedAt: new Date().toISOString() },
      sections,
    };
  }
}
