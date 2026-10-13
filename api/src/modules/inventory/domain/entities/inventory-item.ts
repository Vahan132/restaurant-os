import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InventoryBaseUnit, InventoryItemStatus, ItemKind } from '../enums';
import { InventoryItemCreatedEvent, InventoryItemDeletedEvent } from '../events/inventory-events';
import { ExpiryNotAllowedError, UnknownUnitError } from '../inventory.errors';
import { AlternateUnit } from '../value-objects/alternate-unit';
import { unitCostMicroFromLine } from '../value-objects/money';

export interface InventoryItemProps {
  restaurantId: string;
  branchId: string;
  /**
   * PLATCAT-ADOPT-1B: null for an ADOPTED (catalog-sourced) item — its name is the
   * platform catalog's trilingual name, resolved live at read time. A custom
   * (uncatalogued) item owns a local, non-null name. Identity invariant: name or
   * catalogItemId is always set (mirrored by a DB CHECK).
   */
  name: string | null;
  sku: string | null;
  categoryId: string | null;
  kind: ItemKind;
  baseUnit: InventoryBaseUnit;
  alternateUnits: AlternateUnit[];
  trackExpiry: boolean;
  lowStockThresholdBase: number | null;
  lastUnitCostMicro: bigint | null;
  /**
   * COST-FIFO-1: MICRO unit cost of the batch currently being consumed. Read-only
   * on the aggregate — maintained by ItemCostTracker directly (never persisted
   * from here). Optional so older fixtures stay valid.
   */
  currentUnitCostMicro?: bigint | null;
  /** BRUTTO-1: default cleaning/trim loss in bps (prefills recipe brutto from netto). */
  cleaningLossBps?: number | null;
  /** 6C: per-item consumption location (null => branch default Main Storage). */
  consumptionLocationId: string | null;
  /**
   * CATALOG-1: the platform CatalogItem this item was adopted from (plain scalar,
   * no FK — ADR §4). null = a custom/uncatalogued item; set = catalog-sourced, so
   * catalog values resolve by reference. Set once at adopt; never mutated.
   */
  catalogItemId: string | null;
  status: InventoryItemStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateInventoryItemInput {
  id: string;
  restaurantId: string;
  branchId: string;
  /** Non-null for a custom item; null when adopting from the catalog (name resolves live). */
  name: string | null;
  sku?: string | null;
  categoryId?: string | null;
  kind?: ItemKind;
  baseUnit: InventoryBaseUnit;
  alternateUnits?: ReadonlyArray<{ name: string; factor: number }>;
  trackExpiry?: boolean;
  lowStockThresholdBase?: number | null;
  /** BRUTTO-1: default cleaning/trim loss in basis points (0..9999). */
  cleaningLossBps?: number | null;
  /** CATALOG-1: set when adopting from the platform catalog; default null. */
  catalogItemId?: string | null;
  actorUserId?: string | null;
}

/** InventoryItem aggregate (catalog, soft-delete; tenant-scoped). Raw or processed. */
export class InventoryItem extends AggregateRoot<string> {
  private props: InventoryItemProps;

  private constructor(id: string, props: InventoryItemProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateInventoryItemInput): InventoryItem {
    const now = new Date();
    const item = new InventoryItem(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      sku: input.sku ?? null,
      categoryId: input.categoryId ?? null,
      kind: input.kind ?? ItemKind.RAW,
      baseUnit: input.baseUnit,
      alternateUnits: AlternateUnit.fromList(input.alternateUnits ?? []),
      trackExpiry: input.trackExpiry ?? false,
      lowStockThresholdBase: input.lowStockThresholdBase ?? null,
      lastUnitCostMicro: null,
      currentUnitCostMicro: null,
      cleaningLossBps: input.cleaningLossBps ?? null,
      consumptionLocationId: null,
      catalogItemId: input.catalogItemId ?? null,
      status: InventoryItemStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    item.addDomainEvent(
      new InventoryItemCreatedEvent(
        input.id,
        input.restaurantId,
        item.props.kind,
        input.actorUserId ?? null,
      ),
    );
    return item;
  }

  static reconstitute(id: string, props: InventoryItemProps): InventoryItem {
    return new InventoryItem(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  /** Local name; null for an adopted item (resolve the catalog name live for display). */
  get name(): string | null {
    return this.props.name;
  }
  get sku(): string | null {
    return this.props.sku;
  }
  get categoryId(): string | null {
    return this.props.categoryId;
  }
  get kind(): ItemKind {
    return this.props.kind;
  }
  get baseUnit(): InventoryBaseUnit {
    return this.props.baseUnit;
  }
  get alternateUnits(): AlternateUnit[] {
    return this.props.alternateUnits;
  }
  get trackExpiry(): boolean {
    return this.props.trackExpiry;
  }
  get lowStockThresholdBase(): number | null {
    return this.props.lowStockThresholdBase;
  }
  get lastUnitCostMicro(): bigint | null {
    return this.props.lastUnitCostMicro;
  }
  get currentUnitCostMicro(): bigint | null {
    return this.props.currentUnitCostMicro ?? null;
  }
  get cleaningLossBps(): number | null {
    return this.props.cleaningLossBps ?? null;
  }
  get consumptionLocationId(): string | null {
    return this.props.consumptionLocationId;
  }
  get catalogItemId(): string | null {
    return this.props.catalogItemId;
  }
  get status(): InventoryItemStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /**
   * Resolve an entered unit name to a base-unit conversion factor. Matches the
   * canonical base unit (factor 1, by enum value, case-insensitive) or a defined
   * alternate unit by name. Throws UnknownUnitError for anything else.
   */
  resolveUnitFactor(unit: string): number {
    const u = (unit ?? '').trim();
    if (!u) {
      throw new UnknownUnitError(String(unit));
    }
    if (u.toLowerCase() === this.props.baseUnit.toLowerCase()) {
      return 1;
    }
    const alt = this.props.alternateUnits.find((a) => a.name.toLowerCase() === u.toLowerCase());
    if (!alt) {
      throw new UnknownUnitError(u);
    }
    return alt.factor;
  }

  /** Convert an entered quantity in `unit` to the item's integer base unit. */
  toBaseQty(unit: string, enteredQty: number): number {
    return enteredQty * this.resolveUnitFactor(unit);
  }

  /** Enforce that expiry dating is only used by expiry-tracked items. */
  assertExpiryAllowed(expiryDate?: Date | null): void {
    if (expiryDate && !this.props.trackExpiry) {
      throw new ExpiryNotAllowedError();
    }
  }

  /** MICRO unit cost derived from a receipt line (used to refresh lastUnitCostMicro). */
  unitCostMicroFor(lineTotalCostAmount: number, baseQty: number): bigint {
    return unitCostMicroFromLine(lineTotalCostAmount, baseQty);
  }

  updateDetails(input: {
    name?: string;
    sku?: string | null;
    categoryId?: string | null;
    kind?: ItemKind;
    alternateUnits?: ReadonlyArray<{ name: string; factor: number }>;
    trackExpiry?: boolean;
    lowStockThresholdBase?: number | null;
    cleaningLossBps?: number | null;
    status?: InventoryItemStatus;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.sku !== undefined) this.props.sku = input.sku;
    if (input.categoryId !== undefined) this.props.categoryId = input.categoryId;
    if (input.kind !== undefined) this.props.kind = input.kind;
    if (input.alternateUnits !== undefined)
      this.props.alternateUnits = AlternateUnit.fromList(input.alternateUnits);
    if (input.trackExpiry !== undefined) this.props.trackExpiry = input.trackExpiry;
    if (input.lowStockThresholdBase !== undefined)
      this.props.lowStockThresholdBase = input.lowStockThresholdBase;
    if (input.cleaningLossBps !== undefined) this.props.cleaningLossBps = input.cleaningLossBps;
    if (input.status !== undefined) this.props.status = input.status;
    this.touch();
  }

  /** 6C: reassign the item's consumption location (null => branch default). */
  setConsumptionLocation(locationId: string | null): void {
    this.props.consumptionLocationId = locationId;
    this.touch();
  }

  softDelete(actorUserId: string | null = null): void {
    this.props.deletedAt = new Date();
    this.touch();
    this.addDomainEvent(
      new InventoryItemDeletedEvent(this.id, this.props.restaurantId, actorUserId),
    );
  }
}
