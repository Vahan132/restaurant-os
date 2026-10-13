import { Injectable } from '@nestjs/common';
import { Locale, resolveI18n } from '../../../shared/i18n/locale';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import {
  PublicBranchInfo,
  PublicMenuCategory,
  PublicModifierGroup,
  PublicRestaurantInfo,
  PublicStorefrontQuery,
  PublicTableInfo,
} from '../application/ports/public-query.port';

/**
 * Public storefront read model (Prisma directly). Returns ONLY active,
 * public-safe data scoped to the given restaurantId. Soft-deleted/inactive rows
 * and all internal fields (costs, stations, notes, users) are excluded.
 */
@Injectable()
export class PrismaPublicStorefrontQuery implements PublicStorefrontQuery {
  constructor(private readonly prisma: PrismaService) {}

  async restaurantInfo(restaurantId: string): Promise<PublicRestaurantInfo | null> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      select: { name: true, currency: true, defaultLanguage: true, timezone: true },
    });
    if (!restaurant) {
      return null;
    }
    const settings = await this.prisma.restaurantSettings.findUnique({
      where: { restaurantId },
      select: {
        logoUrl: true,
        address: true,
        phone: true,
        openingHours: true,
        enableQrMenu: true,
        enableCustomerOrdering: true,
      },
    });
    return {
      name: restaurant.name,
      logoUrl: settings?.logoUrl ?? null,
      currency: restaurant.currency,
      defaultLanguage: restaurant.defaultLanguage,
      timezone: restaurant.timezone,
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      openingHours: settings?.openingHours ?? null,
      orderingEnabled:
        (settings?.enableQrMenu ?? false) && (settings?.enableCustomerOrdering ?? false),
    };
  }

  async menuCurrency(restaurantId: string): Promise<string> {
    // ORDER-4: menu prices render in the restaurant's currency — the SAME source
    // the ORDER-2 cart/order snapshots (order-settings reader), so they always
    // agree. Defaults to 'USD' if unset, matching PrismaOrderSettingsReader.
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      select: { currency: true },
    });
    return restaurant?.currency ?? 'USD';
  }

  async defaultLanguage(restaurantId: string): Promise<string> {
    // LOCALE-1: the restaurant's authored primary language — the fallback for the
    // guest's effective locale when no valid X-Locale is sent. Defaults to 'en'
    // (matching Restaurant.defaultLanguage @default("en")).
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
      select: { defaultLanguage: true },
    });
    return restaurant?.defaultLanguage ?? 'en';
  }

  async menuTree(
    restaurantId: string,
    branchId: string,
    // LOCALE-2B: the guest's effective locale. Each localizable field resolves as
    // `translation(locale) ?? primary` via resolveI18n; the response shape stays a
    // single resolved string (guests get one language, never the {hy,ru,en} object).
    locale: Locale,
  ): Promise<PublicMenuCategory[]> {
    // BR-9: the menu is branch-owned (BR-2). The branch is resolved upstream from
    // the URL slug or the table QR token — never defaulted here.
    const categories = await this.prisma.menuCategory.findMany({
      where: { restaurantId, branchId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { displayOrder: 'asc' },
    });
    const items = await this.prisma.menuItem.findMany({
      where: { restaurantId, branchId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    const itemIds = items.map((i) => i.id);

    // Prompt 1A: a dish's groups come from the dish_modifier_groups join (in
    // attachment order), with effective (override-resolved) rules. Only ACTIVE,
    // non-deleted groups/options are public.
    const links = itemIds.length
      ? await this.prisma.dishModifierGroup.findMany({
          where: { restaurantId, branchId, menuItemId: { in: itemIds } },
          orderBy: { sortOrder: 'asc' },
        })
      : [];
    const groupIds = [...new Set(links.map((l) => l.modifierGroupId))];
    const groups = groupIds.length
      ? await this.prisma.modifierGroup.findMany({
          where: {
            id: { in: groupIds },
            restaurantId,
            branchId,
            status: 'ACTIVE',
            deletedAt: null,
          },
        })
      : [];
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const options = groupIds.length
      ? await this.prisma.modifierOption.findMany({
          where: {
            restaurantId,
            deletedAt: null,
            status: 'ACTIVE',
            modifierGroupId: { in: groupIds },
          },
          orderBy: { sortOrder: 'asc' },
        })
      : [];

    const optionsByGroup = new Map<
      string,
      { id: string; name: string; priceDeltaAmount: number }[]
    >();
    for (const o of options) {
      const arr = optionsByGroup.get(o.modifierGroupId) ?? [];
      arr.push({
        id: o.id,
        // LOCALE-2B: resolved option name for the guest locale.
        name: resolveI18n(locale, { hy: o.nameHy, ru: o.nameRu, en: o.nameEn }, o.name),
        priceDeltaAmount: o.priceDeltaAmount,
      });
      optionsByGroup.set(o.modifierGroupId, arr);
    }
    const groupsByItem = new Map<string, PublicModifierGroup[]>();
    for (const link of links) {
      const g = groupById.get(link.modifierGroupId);
      if (!g) {
        continue;
      }
      const eff = resolveEffectivePublicRules(g, link);
      const arr = groupsByItem.get(link.menuItemId) ?? [];
      arr.push({
        id: g.id,
        // LOCALE-2B: resolved group name for the guest locale.
        name: resolveI18n(locale, { hy: g.nameHy, ru: g.nameRu, en: g.nameEn }, g.name),
        selectionType: eff.selectionType,
        required: eff.required,
        minSelect: eff.minSelect,
        maxSelect: eff.maxSelect,
        options: optionsByGroup.get(g.id) ?? [],
      });
      groupsByItem.set(link.menuItemId, arr);
    }

    const itemsByCategory = new Map<string, typeof items>();
    for (const it of items) {
      const arr = itemsByCategory.get(it.categoryId) ?? [];
      arr.push(it);
      itemsByCategory.set(it.categoryId, arr);
    }

    // LOCALE-2B: resolve category + item name/description for the guest locale
    // (translation(locale) ?? primary). A null primary description with no
    // translation stays null.
    return categories.map((c) => ({
      id: c.id,
      name: resolveI18n(locale, { hy: c.nameHy, ru: c.nameRu, en: c.nameEn }, c.name),
      description: resolveI18n(
        locale,
        { hy: c.descriptionHy, ru: c.descriptionRu, en: c.descriptionEn },
        c.description,
      ),
      items: (itemsByCategory.get(c.id) ?? []).map((it) => ({
        id: it.id,
        name: resolveI18n(locale, { hy: it.nameHy, ru: it.nameRu, en: it.nameEn }, it.name),
        description: resolveI18n(
          locale,
          { hy: it.descriptionHy, ru: it.descriptionRu, en: it.descriptionEn },
          it.description,
        ),
        priceAmount: it.priceAmount,
        imageUrl: it.imageUrl,
        available: it.availability === 'AVAILABLE',
        modifierGroups: groupsByItem.get(it.id) ?? [],
      })),
    }));
  }

  async tableByQr(restaurantId: string, qrIdentifier: string): Promise<PublicTableInfo | null> {
    const table = await this.prisma.restaurantTable.findFirst({
      where: { restaurantId, qrIdentifier, deletedAt: null },
      select: { id: true, name: true, floorId: true, branchId: true },
    });
    if (!table) {
      return null;
    }
    // BR-9: a scanned table belongs to a branch; surface it so the QR app fetches
    // that branch's own menu/prices. Only ACTIVE branches are publicly serviceable.
    const branch = await this.prisma.branch.findFirst({
      where: { id: table.branchId, restaurantId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, slug: true },
    });
    if (!branch) {
      return null;
    }
    const floor = await this.prisma.floor.findFirst({
      where: { id: table.floorId, restaurantId },
      select: { name: true },
    });
    return {
      tableId: table.id,
      name: table.name,
      floorName: floor?.name ?? null,
      branchId: branch.id,
      branchName: branch.name,
      branchSlug: branch.slug,
    };
  }

  async activeBranches(restaurantId: string): Promise<PublicBranchInfo[]> {
    const branches = await this.prisma.branch.findMany({
      where: { restaurantId, status: 'ACTIVE', deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true },
    });
    return branches.map((b) => ({ id: b.id, name: b.name, slug: b.slug }));
  }

  async defaultBranchId(restaurantId: string): Promise<string | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { restaurantId, isDefault: true, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    return branch?.id ?? null;
  }
}

// Inlined copy of menu/domain/modifier-rules.resolveEffectiveModifierRules — the
// public storefront resolves a dish's effective modifier rules so the QR app never
// recomputes them. Kept local to avoid a cross-module domain import.
function resolveEffectivePublicRules(
  base: {
    selectionType: string;
    required: boolean;
    minSelect: number | null;
    maxSelect: number | null;
  },
  ov: { requiredOverride: boolean | null; minOverride: number | null; maxOverride: number | null },
): { selectionType: string; required: boolean; minSelect: number; maxSelect: number | null } {
  const selectionType = String(base.selectionType);
  const required = ov.requiredOverride ?? base.required;
  if (selectionType === 'SINGLE') {
    return { selectionType, required, minSelect: required ? 1 : 0, maxSelect: 1 };
  }
  let min = ov.minOverride ?? base.minSelect ?? (required ? 1 : 0);
  let max = ov.maxOverride ?? base.maxSelect ?? null;
  if (min < 0) min = 0;
  if (required && min < 1) min = 1;
  if (max !== null && max < 1) max = 1;
  if (max !== null && min > max) min = max;
  return { selectionType, required, minSelect: min, maxSelect: max };
}
