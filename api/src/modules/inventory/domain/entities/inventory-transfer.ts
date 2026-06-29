import { Entity } from '../../../../shared/domain/entity';

/** One consumed source slice relocated to the destination (audit detail). */
export interface InventoryTransferSliceView {
  id: string;
  sourceLayerId: string | null;
  destinationLayerId: string;
  baseQty: number;
  costAmount: number;
  unitCostMicro: bigint;
}

export interface InventoryTransferProps {
  restaurantId: string;
  branchId: string;
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  performedByUserId: string;
  occurredAt: Date;
  createdAt: Date;
  /** Populated on the detail view; empty on list rows. */
  slices: InventoryTransferSliceView[];
}

/**
 * InventoryTransfer (6B) — a within-branch relocation of stock at carrying cost.
 * The header is append-only; the slices record the consumed source lots for audit.
 */
export class InventoryTransfer extends Entity<string> {
  private props: InventoryTransferProps;

  private constructor(id: string, props: InventoryTransferProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: InventoryTransferProps): InventoryTransfer {
    return new InventoryTransfer(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get fromLocationId(): string {
    return this.props.fromLocationId;
  }
  get toLocationId(): string {
    return this.props.toLocationId;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get performedByUserId(): string {
    return this.props.performedByUserId;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get slices(): InventoryTransferSliceView[] {
    return this.props.slices;
  }
}
