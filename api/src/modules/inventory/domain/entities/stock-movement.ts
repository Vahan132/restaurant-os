import { Entity } from '../../../../shared/domain/entity';
import { StockMovementType } from '../enums';

export interface StockMovementProps {
  restaurantId: string;
  branchId: string;
  /** 6A: the location this movement applies to. */
  locationId: string;
  itemId: string;
  type: StockMovementType;
  /** SIGNED base qty: + in, - out. */
  baseQty: number;
  /** SIGNED costed value (minor units). */
  costAmount: number;
  layerId: string | null;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  occurredAt: Date;
  createdByUserId: string;
  createdAt: Date;
}

/**
 * StockMovement (append-only ledger; source of truth for on-hand qty). Never
 * updated or deleted. Reads only — writes go through the ledger gateway.
 */
export class StockMovement extends Entity<string> {
  private props: StockMovementProps;

  private constructor(id: string, props: StockMovementProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: StockMovementProps): StockMovement {
    return new StockMovement(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get locationId(): string {
    return this.props.locationId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get type(): StockMovementType {
    return this.props.type;
  }
  get baseQty(): number {
    return this.props.baseQty;
  }
  get costAmount(): number {
    return this.props.costAmount;
  }
  get layerId(): string | null {
    return this.props.layerId;
  }
  get reason(): string | null {
    return this.props.reason;
  }
  get refType(): string | null {
    return this.props.refType;
  }
  get refId(): string | null {
    return this.props.refId;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
