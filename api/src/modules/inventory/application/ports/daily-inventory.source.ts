export const DAILY_INVENTORY_SOURCE = Symbol('DailyInventorySource');

/** Σ of signed ledger movements for one (item, type, refType) bucket. */
export interface LedgerBucket {
  itemId: string;
  type: string;
  refType: string | null;
  qty: number;
  cost: number;
}

export interface DailyItemInfo {
  id: string;
  name: string | null;
  catalogItemId: string | null;
  baseUnit: string;
  alternateUnits: Array<{ name: string; factor: number }>;
  categoryId: string | null;
  categoryName: string | null;
  currentUnitCostMicro: bigint | null;
}

export interface ScheduledBranch {
  restaurantId: string;
  branchId: string;
  timezone: string;
}

/** DAILY-INV-1: raw reads + snapshot store behind the end-of-day report. */
export interface DailyInventorySource {
  /** Ledger sums in [from, to). `from` null = since the beginning (opening balances). */
  ledgerBuckets(
    restaurantId: string,
    branchId: string,
    from: Date | null,
    to: Date,
  ): Promise<LedgerBucket[]>;

  itemsInfo(restaurantId: string, branchId: string, itemIds: string[]): Promise<DailyItemInfo[]>;

  menuItemNames(restaurantId: string, menuItemIds: string[]): Promise<Map<string, string>>;

  restaurantTimezone(restaurantId: string): Promise<string>;

  findSnapshot(branchId: string, businessDate: string): Promise<unknown | null>;

  saveSnapshot(input: {
    restaurantId: string;
    branchId: string;
    businessDate: string;
    timezone: string;
    payload: unknown;
    generatedAt: Date;
  }): Promise<void>;

  /** Active branches of active restaurants (nightly job). */
  scheduledBranches(): Promise<ScheduledBranch[]>;
}
