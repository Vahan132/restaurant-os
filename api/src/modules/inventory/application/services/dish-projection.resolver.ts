import { Inject, Injectable } from '@nestjs/common';
import {
  CatalogResolutionService,
  EffectiveStockItem,
  StockItemResolutionInput,
} from '../../../platform-catalog/application/services/catalog-resolution.service';
import { Recipe } from '../../domain/entities/recipe';
import {
  ITEM_RESOLUTION_READER,
  ItemResolutionReader,
  ItemResolutionRow,
} from '../ports/item-resolution.reader';
import { MENU_ITEM_LOOKUP, MenuItemLookup } from '../ports/menu-item.lookup';
import { ProducedItemGraphService } from './produced-item-graph.service';

/** Supported customer-projection locales (names live only on the catalog). */
export type Locale = 'hy' | 'ru' | 'en';
const LOCALES: readonly Locale[] = ['hy', 'ru', 'en'];

/** Coerce an arbitrary string to a supported locale (defaults to 'en'). */
export function toLocale(value: string | null | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : 'en';
}

/** Customer projection line: a localized ingredient name, no quantity (ADR §7). */
export interface CustomerIngredient {
  itemId: string;
  name: string;
}

/** Operational projection line: component + quantity + unit (owner-only). */
export interface OperationalIngredient {
  itemId: string;
  baseQty: number;
  /** From InventoryItem.baseUnit, NOT the recipe line (finding NOTE 1). */
  unit: string;
}

/** Honest allergen rollup for a dish (derived at resolve time, never stored). */
export interface DishAllergens {
  /** Union of effective allergen slugs over every contributing leaf. */
  slugs: string[];
  /**
   * True only when EVERY contributing leaf is verified (catalogSourced && reviewed).
   * Never inferred from an empty `slugs` (empty = known-none, not unknown).
   */
  complete: boolean;
  /** Leaf item ids that made the profile incomplete (custom / stale / unreviewed). */
  unverifiedItemIds: string[];
}

/** One resolver, two projections + the allergen rollup (CATALOG-3-FE and -4 share it). */
export interface DishProjection {
  hideRecipe: boolean;
  /** Localized ingredient names; null when hideRecipe hides the customer list. */
  customerIngredients: CustomerIngredient[] | null;
  operationalIngredients: OperationalIngredient[];
  allergens: DishAllergens;
}

const UNKNOWN_UNIT = 'UNKNOWN';

/**
 * CATALOG-3 dish resolver (ADR §6–§9). From ONE recipe it produces:
 *   - the operational projection (owner): line item + baseQty + unit,
 *   - the customer projection: localized ingredient names, no quantities, display
 *     depth-1 (each recipe line item emits its OWN name — produced items are NOT
 *     expanded), omitted entirely when hideRecipe,
 *   - the allergen rollup: full recursion to leaves via ProducedItemGraphService
 *     (CATALOG-1b, reused as-is), effective allergens per leaf (CATALOG-1
 *     precedence), unioned, with an honest unverified-leaf state.
 * Modifier-consumption items contribute to the allergen walk (§Locked-2) but not
 * to the base customer list (they are conditional add-ons).
 */
@Injectable()
export class DishProjectionResolver {
  constructor(
    private readonly graph: ProducedItemGraphService,
    private readonly catalog: CatalogResolutionService,
    @Inject(ITEM_RESOLUTION_READER)
    private readonly items: ItemResolutionReader,
    @Inject(MENU_ITEM_LOOKUP)
    private readonly menu: MenuItemLookup,
  ) {}

  async resolve(recipe: Recipe, locale: Locale): Promise<DishProjection> {
    const { restaurantId, branchId } = recipe;

    const hideRecipe = await this.menu.hideRecipeByMenuItemId(
      restaurantId,
      recipe.menuItemId,
    );

    const lineItemIds = unique(recipe.lines.map((l) => l.itemId));
    const modifierItemIds = unique(
      recipe.modifierConsumptions.map((m) => m.itemId),
    );

    // Allergen walk roots = recipe-line items + modifier-consumption items (§Locked-2).
    // Each root is walked to its leaves via the CATALOG-1b primitive (reused as-is).
    const allergenRootIds = unique([...lineItemIds, ...modifierItemIds]);
    const leafIds = new Set<string>();
    for (const rootId of allergenRootIds) {
      const visits = await this.graph.walk(restaurantId, branchId, rootId);
      for (const v of visits) {
        if (v.isLeaf) {
          leafIds.add(v.itemId);
        }
      }
    }

    // One inventory read + one catalog resolution over the union of the items we
    // must describe (line items — for names/units) and every contributing leaf
    // (for allergens). resolveMany batches the catalog read (no N+1).
    const describeIds = unique([...lineItemIds, ...leafIds]);
    const rows = await this.items.byIds(restaurantId, branchId, describeIds);
    const effective = await this.catalog.resolveMany(
      describeIds.map((id) => resolutionInput(id, rows.get(id))),
    );

    // Customer projection (depth-1 names, no quantities) — omitted when hidden.
    const customerIngredients = hideRecipe
      ? null
      : unique(recipe.lines.map((l) => l.itemId)).map((itemId) => ({
          itemId,
          name: this.displayName(itemId, locale, rows.get(itemId), effective),
        }));

    // Operational projection (owner): one entry per recipe line, unit from the item.
    const operationalIngredients: OperationalIngredient[] = recipe.lines.map(
      (l) => ({
        itemId: l.itemId,
        baseQty: l.baseQty,
        unit: rows.get(l.itemId)?.baseUnit ?? UNKNOWN_UNIT,
      }),
    );

    // Allergen rollup: union leaf effective allergens; any unverified leaf => incomplete.
    const slugs = new Set<string>();
    const unverified = new Set<string>();
    for (const leafId of leafIds) {
      const eff = effective.get(leafId);
      if (!eff) {
        unverified.add(leafId); // no resolvable inventory row => unverified
        continue;
      }
      for (const s of eff.allergenSlugs) {
        slugs.add(s);
      }
      if (!eff.verified) {
        unverified.add(leafId);
      }
    }

    return {
      hideRecipe,
      customerIngredients,
      operationalIngredients,
      allergens: {
        slugs: [...slugs].sort(),
        complete: unverified.size === 0,
        unverifiedItemIds: [...unverified],
      },
    };
  }

  /** Localized catalog name when catalog-sourced; else the item's own name; else the id. */
  private displayName(
    itemId: string,
    locale: Locale,
    row: ItemResolutionRow | undefined,
    effective: Map<string, EffectiveStockItem>,
  ): string {
    const catalogName = effective.get(itemId)?.catalogName ?? null;
    if (catalogName) {
      return catalogName[locale];
    }
    return row?.name ?? itemId;
  }
}

function unique<T>(xs: readonly T[]): T[] {
  return [...new Set(xs)];
}

/** Build a CATALOG-1 resolution input from an item row (missing row => uncatalogued). */
function resolutionInput(
  id: string,
  row: ItemResolutionRow | undefined,
): StockItemResolutionInput & { key: string } {
  return {
    key: id,
    catalogItemId: row?.catalogItemId ?? null,
    allergenOverride: row?.allergenOverride ?? null,
    adgCodeOverride: row?.adgCodeOverride ?? null,
  };
}
