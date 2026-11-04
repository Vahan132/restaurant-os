import { Inject, Injectable } from '@nestjs/common';
import { CatalogLocalizedName } from '../../../platform-catalog/domain/repositories/catalog-item.reader';
import { todayInTz, zonedDayRange } from '../../../reports/application/report-time.util';
import {
  ORDER_LINE_REF_TYPE,
  PROCESS_RUN_REF_TYPE,
  StockMovementType,
  TRANSFER_REF_TYPE,
  WRITE_OFF_REF_TYPE,
} from '../../domain/enums';
import { COST_HISTORY_READER, CostHistoryReader } from '../ports/cost-history.reader';
import {
  DAILY_INVENTORY_SOURCE,
  DailyInventorySource,
  LedgerBucket,
} from '../ports/daily-inventory.source';
import { InventoryItemNameResolver } from './inventory-item-name.resolver';

const COUNT_ADJUSTMENT_REF_TYPE = 'COUNT_ADJUSTMENT';

/** Qty (base units, signed as it affects on-hand) + value (minor units, signed). */
export interface QtyValue {
  qty: number;
  value: number;
}

export interface DailyItemRow {
  itemId: string;
  name: string | null;
  catalogName: CatalogLocalizedName | null;
  baseUnit: string;
  alternateUnits: Array<{ name: string; factor: number }>;
  categoryName: string | null;
  opening: QtyValue;
  /** Goods receipts (+). */
  received: QtyValue;
  /** Sold via dishes, net of voids (−). */
  sold: QtyValue;
  /** Produced by processes (+). */
  produced: QtyValue;
  /** Used as process input (−). */
  usedInProduction: QtyValue;
  /** Write-offs / waste, net of voided write-offs (−). */
  wasted: QtyValue;
  /** Physical count corrections — the counted-vs-system inconsistency (±). */
  countVariance: QtyValue;
  /** Manual adjustments + opening balances (±). */
  adjusted: QtyValue;
  /** Net of within-branch transfers (normally 0 at branch level). */
  transferred: QtyValue;
  closing: QtyValue;
  /** Current batch unit cost (MICRO, string) at report time. */
  currentUnitCostMicro: string | null;
}

export interface DailyTotals {
  openingValue: number;
  receivedValue: number;
  soldValue: number;
  producedValue: number;
  usedInProductionValue: number;
  wastedValue: number;
  countVarianceValue: number;
  adjustedValue: number;
  closingValue: number;
  itemsMoved: number;
  negativeItems: number;
}

export interface DailyItemCostChange {
  itemId: string;
  name: string | null;
  catalogName: CatalogLocalizedName | null;
  baseUnit: string;
  oldUnitCostMicro: string | null;
  newUnitCostMicro: string;
  supplierName: string | null;
  trigger: string;
  occurredAt: string;
}

export interface DailyDishCostChange {
  recipeId: string;
  menuItemId: string;
  menuItemName: string | null;
  oldCostAmount: number | null;
  newCostAmount: number;
  causeItemId: string | null;
  causeItemName: string | null;
  causeCatalogName: CatalogLocalizedName | null;
  occurredAt: string;
}

export interface DailyInventoryReport {
  branchId: string;
  /** First business day of the report (the only day for a daily report). */
  businessDate: string;
  /** Last business day (inclusive). Equals businessDate for a single day. */
  endDate: string;
  timezone: string;
  from: string;
  to: string;
  generatedAt: string;
  /** True when served from the frozen nightly snapshot. */
  frozen: boolean;
  /** True while the business day is still running (numbers will change). */
  inProgress: boolean;
  totals: DailyTotals;
  items: DailyItemRow[];
  itemCostChanges: DailyItemCostChange[];
  dishCostChanges: DailyDishCostChange[];
}

const zero = (): QtyValue => ({ qty: 0, value: 0 });
const add = (a: QtyValue, b: LedgerBucket): void => {
  a.qty += b.qty;
  a.value += b.cost;
};

/** Which report column a ledger bucket belongs to. */
function column(
  b: LedgerBucket,
):
  | 'received'
  | 'sold'
  | 'produced'
  | 'usedInProduction'
  | 'wasted'
  | 'countVariance'
  | 'adjusted'
  | 'transferred' {
  switch (b.type) {
    case StockMovementType.RECEIPT_IN:
      return 'received';
    case StockMovementType.CONSUMPTION_OUT:
      return 'sold';
    case StockMovementType.WRITE_OFF_OUT:
      return 'wasted';
    case StockMovementType.PROCESS_IN:
      return 'produced';
    case StockMovementType.PROCESS_OUT:
      return 'usedInProduction';
    case StockMovementType.TRANSFER_IN:
    case StockMovementType.TRANSFER_OUT:
      return 'transferred';
    case StockMovementType.CONSUMPTION_REVERSAL:
      // A reversal lands back in the column of what it undoes.
      if (b.refType === WRITE_OFF_REF_TYPE) return 'wasted';
      if (b.refType === PROCESS_RUN_REF_TYPE) return 'usedInProduction';
      if (b.refType === TRANSFER_REF_TYPE) return 'transferred';
      if (b.refType === COUNT_ADJUSTMENT_REF_TYPE) return 'countVariance';
      if (b.refType === ORDER_LINE_REF_TYPE) return 'sold';
      return 'adjusted';
    default:
      // ADJUSTMENT_IN / ADJUSTMENT_OUT / OPENING
      return b.refType === COUNT_ADJUSTMENT_REF_TYPE ? 'countVariance' : 'adjusted';
  }
}

/**
 * DAILY-INV-1: builds the end-of-day inventory report for one branch + business
 * day (restaurant timezone) straight from the append-only ledger: per item
 * opening -> received / sold / produced / used / wasted / counted / adjusted ->
 * closing (qty + value), plus the day's ingredient and dish cost-price changes.
 */
@Injectable()
export class DailyInventoryReportService {
  constructor(
    @Inject(DAILY_INVENTORY_SOURCE) private readonly source: DailyInventorySource,
    @Inject(COST_HISTORY_READER) private readonly history: CostHistoryReader,
    private readonly names: InventoryItemNameResolver,
  ) {}

  todayFor(timezone: string, now: Date = new Date()): string {
    return todayInTz(timezone, now);
  }

  async build(
    restaurantId: string,
    branchId: string,
    businessDate: string,
    timezone: string,
    now: Date = new Date(),
  ): Promise<DailyInventoryReport> {
    return this.buildRange(restaurantId, branchId, businessDate, businessDate, timezone, now);
  }

  /**
   * Same report over several business days [fromDate .. toDate] (inclusive):
   * opening = balance at the start of fromDate, movements summed over the whole
   * range, closing = balance at the end of toDate.
   */
  async buildRange(
    restaurantId: string,
    branchId: string,
    businessDate: string,
    endDate: string,
    timezone: string,
    now: Date = new Date(),
  ): Promise<DailyInventoryReport> {
    const start = zonedDayRange(businessDate, timezone).start;
    const end = zonedDayRange(endDate, timezone).end;
    const [openingBuckets, dayBuckets, itemChanges, dishChanges] = await Promise.all([
      this.source.ledgerBuckets(restaurantId, branchId, null, start),
      this.source.ledgerBuckets(restaurantId, branchId, start, end),
      this.history.itemChangesBetween(restaurantId, branchId, start, end),
      this.history.recipeChangesBetween(restaurantId, branchId, start, end),
    ]);

    const rows = new Map<string, DailyItemRow>();
    const row = (itemId: string): DailyItemRow => {
      let r = rows.get(itemId);
      if (!r) {
        r = {
          itemId,
          name: null,
          catalogName: null,
          baseUnit: 'PIECE',
          alternateUnits: [],
          categoryName: null,
          opening: zero(),
          received: zero(),
          sold: zero(),
          produced: zero(),
          usedInProduction: zero(),
          wasted: zero(),
          countVariance: zero(),
          adjusted: zero(),
          transferred: zero(),
          closing: zero(),
          currentUnitCostMicro: null,
        };
        rows.set(itemId, r);
      }
      return r;
    };

    for (const b of openingBuckets) add(row(b.itemId).opening, b);
    const moved = new Set<string>();
    for (const b of dayBuckets) {
      add(row(b.itemId)[column(b)], b);
      moved.add(b.itemId);
    }

    // Keep items that moved today or still hold (or owe) stock.
    for (const [id, r] of rows) {
      if (!moved.has(id) && r.opening.qty === 0 && r.opening.value === 0) rows.delete(id);
    }

    const causeIds = dishChanges.map((d) => d.causeItemId).filter((x): x is string => !!x);
    const allItemIds = [
      ...new Set([...rows.keys(), ...itemChanges.map((c) => c.itemId), ...causeIds]),
    ];
    const infos = await this.source.itemsInfo(restaurantId, branchId, allItemIds);
    const infoById = new Map(infos.map((i) => [i.id, i]));
    const catalogNames = await this.names.resolveMany(
      infos.map((i) => ({ id: i.id, catalogItemId: i.catalogItemId })),
    );

    const totals: DailyTotals = {
      openingValue: 0,
      receivedValue: 0,
      soldValue: 0,
      producedValue: 0,
      usedInProductionValue: 0,
      wastedValue: 0,
      countVarianceValue: 0,
      adjustedValue: 0,
      closingValue: 0,
      itemsMoved: moved.size,
      negativeItems: 0,
    };

    for (const r of rows.values()) {
      const info = infoById.get(r.itemId);
      if (info) {
        r.name = info.name;
        r.catalogName = catalogNames.get(r.itemId) ?? null;
        r.baseUnit = info.baseUnit;
        r.alternateUnits = info.alternateUnits;
        r.categoryName = info.categoryName;
        r.currentUnitCostMicro =
          info.currentUnitCostMicro === null ? null : info.currentUnitCostMicro.toString();
      }
      const parts = [
        r.received,
        r.sold,
        r.produced,
        r.usedInProduction,
        r.wasted,
        r.countVariance,
        r.adjusted,
        r.transferred,
      ];
      r.closing = {
        qty: r.opening.qty + parts.reduce((s, p) => s + p.qty, 0),
        value: r.opening.value + parts.reduce((s, p) => s + p.value, 0),
      };
      totals.openingValue += r.opening.value;
      totals.receivedValue += r.received.value;
      totals.soldValue += r.sold.value;
      totals.producedValue += r.produced.value;
      totals.usedInProductionValue += r.usedInProduction.value;
      totals.wastedValue += r.wasted.value;
      totals.countVarianceValue += r.countVariance.value;
      totals.adjustedValue += r.adjusted.value + r.transferred.value;
      totals.closingValue += r.closing.value;
      if (r.closing.qty < 0) totals.negativeItems += 1;
    }

    const items = [...rows.values()].sort((a, b) => {
      const an = a.name ?? a.catalogName?.en ?? '';
      const bn = b.name ?? b.catalogName?.en ?? '';
      return an.localeCompare(bn);
    });

    const menuNames = await this.source.menuItemNames(restaurantId, [
      ...new Set(dishChanges.map((d) => d.menuItemId)),
    ]);

    return {
      branchId,
      businessDate,
      endDate,
      timezone,
      from: start.toISOString(),
      to: end.toISOString(),
      generatedAt: now.toISOString(),
      frozen: false,
      inProgress: now < end,
      totals,
      items,
      itemCostChanges: itemChanges.map((c) => {
        const info = infoById.get(c.itemId);
        return {
          itemId: c.itemId,
          name: info?.name ?? null,
          catalogName: catalogNames.get(c.itemId) ?? null,
          baseUnit: info?.baseUnit ?? 'PIECE',
          oldUnitCostMicro: c.oldUnitCostMicro === null ? null : c.oldUnitCostMicro.toString(),
          newUnitCostMicro: c.newUnitCostMicro.toString(),
          supplierName: c.supplierName,
          trigger: c.trigger,
          occurredAt: c.occurredAt.toISOString(),
        };
      }),
      dishCostChanges: dishChanges.map((d) => ({
        recipeId: d.recipeId,
        menuItemId: d.menuItemId,
        menuItemName: menuNames.get(d.menuItemId) ?? null,
        oldCostAmount: d.oldCostAmount,
        newCostAmount: d.newCostAmount,
        causeItemId: d.causeItemId,
        causeItemName: d.causeItemId ? (infoById.get(d.causeItemId)?.name ?? null) : null,
        causeCatalogName: d.causeItemId ? (catalogNames.get(d.causeItemId) ?? null) : null,
        occurredAt: d.occurredAt.toISOString(),
      })),
    };
  }
}
