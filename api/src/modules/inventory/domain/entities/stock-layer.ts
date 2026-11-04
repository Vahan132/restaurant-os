import { Entity } from '../../../../shared/domain/entity';
import { StockLayerStatus } from '../enums';
import { roundedDiv, unitCostMicroFromLine } from '../value-objects/money';

export interface StockLayerProps {
  restaurantId: string;
  branchId: string;
  itemId: string;
  sourceReceiptLineId: string | null;
  baseQtyReceived: number;
  baseQtyRemaining: number;
  lineTotalCostAmount: number;
  receivedAt: Date;
  expiryDate: Date | null;
  status: StockLayerStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * StockLayer (FIFO/FEFO batch). Unit cost is DERIVED, never stored rounded.
 * Mutated only by the consumption gateway (draw-down) within a transaction.
 */
export class StockLayer extends Entity<string> {
  private props: StockLayerProps;

  private constructor(id: string, props: StockLayerProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: StockLayerProps): StockLayer {
    return new StockLayer(id, props);
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
  get sourceReceiptLineId(): string | null {
    return this.props.sourceReceiptLineId;
  }
  get baseQtyReceived(): number {
    return this.props.baseQtyReceived;
  }
  get baseQtyRemaining(): number {
    return this.props.baseQtyRemaining;
  }
  get lineTotalCostAmount(): number {
    return this.props.lineTotalCostAmount;
  }
  get receivedAt(): Date {
    return this.props.receivedAt;
  }
  get expiryDate(): Date | null {
    return this.props.expiryDate;
  }
  get status(): StockLayerStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Derived per-base-unit cost at MICRO precision (for layer visibility). */
  get derivedUnitCostMicro(): bigint {
    return unitCostMicroFromLine(this.props.lineTotalCostAmount, this.props.baseQtyReceived);
  }

  /** Derived costed value of the REMAINING qty (HALF_UP) — used for valuation. */
  get remainingValueAmount(): number {
    return roundedDiv(
      this.props.lineTotalCostAmount * this.props.baseQtyRemaining,
      this.props.baseQtyReceived,
    );
  }
}
