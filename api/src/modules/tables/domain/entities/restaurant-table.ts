import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { StatusChangeSource, TableStatus } from '../enums';
import { TableStatusChangedEvent } from '../events/table-events';
import { isValidTransition } from '../table-status.policy';
import { InvalidTableTransitionError, TableNotDeletableError } from '../tables.errors';

export interface RestaurantTableProps {
  restaurantId: string;
  branchId: string;
  floorId: string;
  name: string;
  seatCapacity: number;
  status: TableStatus;
  qrIdentifier: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateRestaurantTableInput {
  id: string;
  restaurantId: string;
  branchId: string;
  floorId: string;
  name: string;
  seatCapacity: number;
  qrIdentifier?: string | null;
}

/**
 * RestaurantTable aggregate. Status transitions are governed by an explicit
 * state machine (see table-status.policy); changeStatus rejects invalid moves.
 */
export class RestaurantTable extends AggregateRoot<string> {
  private props: RestaurantTableProps;

  private constructor(id: string, props: RestaurantTableProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateRestaurantTableInput): RestaurantTable {
    const now = new Date();
    return new RestaurantTable(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      floorId: input.floorId,
      name: input.name,
      seatCapacity: input.seatCapacity,
      status: TableStatus.AVAILABLE,
      qrIdentifier: input.qrIdentifier ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: RestaurantTableProps): RestaurantTable {
    return new RestaurantTable(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get floorId(): string {
    return this.props.floorId;
  }
  get name(): string {
    return this.props.name;
  }
  get seatCapacity(): number {
    return this.props.seatCapacity;
  }
  get status(): TableStatus {
    return this.props.status;
  }
  get qrIdentifier(): string | null {
    return this.props.qrIdentifier;
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

  updateDetails(input: {
    name?: string;
    seatCapacity?: number;
    floorId?: string;
    qrIdentifier?: string | null;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.seatCapacity !== undefined) this.props.seatCapacity = input.seatCapacity;
    if (input.floorId !== undefined) this.props.floorId = input.floorId;
    if (input.qrIdentifier !== undefined) this.props.qrIdentifier = input.qrIdentifier;
    this.touch();
  }

  /**
   * Transition status through the state machine. Rejects invalid transitions.
   * `source` records whether staff (MANUAL) or an automatic flow (SYSTEM) did it.
   */
  changeStatus(target: TableStatus, source: StatusChangeSource): void {
    const from = this.props.status;
    if (!isValidTransition(from, target)) {
      throw new InvalidTableTransitionError(from, target);
    }
    this.props.status = target;
    this.touch();
    this.addDomainEvent(
      new TableStatusChangedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        from,
        target,
        source,
      ),
    );
  }

  /** Soft-delete; refuses while OCCUPIED or RESERVED. */
  softDelete(): void {
    if (this.props.status === TableStatus.OCCUPIED || this.props.status === TableStatus.RESERVED) {
      throw new TableNotDeletableError();
    }
    this.props.deletedAt = new Date();
    this.touch();
  }
}
