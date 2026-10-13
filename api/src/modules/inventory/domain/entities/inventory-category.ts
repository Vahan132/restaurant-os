import { Entity } from '../../../../shared/domain/entity';

export interface InventoryCategoryProps {
  restaurantId: string;
  branchId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** InventoryCategory (catalog, soft-delete; tenant-scoped). Simple CRUD. */
export class InventoryCategory extends Entity<string> {
  private props: InventoryCategoryProps;

  private constructor(id: string, props: InventoryCategoryProps) {
    super(id);
    this.props = props;
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    name: string;
  }): InventoryCategory {
    const now = new Date();
    return new InventoryCategory(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: InventoryCategoryProps): InventoryCategory {
    return new InventoryCategory(id, props);
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
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  rename(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }
}
