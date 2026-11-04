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

/** One resolver, two projections (CATALOG-3-FE). */
export interface DishProjection {
  hideRecipe: boolean;
  /** Localized ingredient names; null when hideRecipe hides the customer list. */
  customerIngredients: CustomerIngredient[] | null;
  operationalIngredients: OperationalIngredient[];
}

const UNKNOWN_UNIT = 'UNKNOWN';

/**
 * CATALOG-3 dish resolver (ADR §6–§9). From ONE recipe it produces:
 *   - the operational projection (owner): line item + baseQty + unit,
 *   - the customer projection: localized ingredient names, no quantities, display
 *     depth-1 (each recipe line item emits its OWN name — produced items are NOT
 *     expanded), omitted entirely when hideRecipe.
 */
@Injectable()
export class DishProjectionResolver {
  constructor(
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

    // One inventory read + one catalog resolution over the items we must
    // describe (the recipe's line items). resolveMany batches the catalog read.
    const describeIds = lineItemIds;
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

    return { hideRecipe, customerIngredients, operationalIngredients };
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
  return { key: id, catalogItemId: row?.catalogItemId ?? null };
}
