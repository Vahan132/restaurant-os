import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ZoneStatus } from '../enums';
import { FloorHasTablesError } from '../tables.errors';

export interface FloorProps {
  restaurantId: string;
  branchId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: ZoneStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateFloorInput {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
}

/** Floor aggregate (tenant-scoped by restaurantId). */
export class Floor extends AggregateRoot<string> {
  private props: FloorProps;

  private constructor(id: string, props: FloorProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateFloorInput): Floor {
    const now = new Date();
    return new Floor(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      description: input.description ?? null,
      displayOrder: input.displayOrder ?? 0,
      status: ZoneStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: FloorProps): Floor {
    return new Floor(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get displayOrder(): number {
    return this.props.displayOrder;
  }
  get status(): ZoneStatus {
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

  rename(name: string, description?: string | null): void {
    this.props.name = name;
    if (description !== undefined) {
      this.props.description = description;
    }
    this.touch();
  }

  reorder(displayOrder: number): void {
    this.props.displayOrder = displayOrder;
    this.touch();
  }

  activate(): void {
    this.props.status = ZoneStatus.ACTIVE;
    this.touch();
  }

  deactivate(): void {
    this.props.status = ZoneStatus.INACTIVE;
    this.touch();
  }

  /** Soft-delete; refuses if non-deleted tables remain (invariant). */
  softDelete(activeTableCount: number): void {
    if (activeTableCount > 0) {
      throw new FloorHasTablesError();
    }
    this.props.deletedAt = new Date();
    this.touch();
  }
}
