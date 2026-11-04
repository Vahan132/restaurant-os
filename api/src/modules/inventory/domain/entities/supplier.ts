import { Entity } from '../../../../shared/domain/entity';

export interface SupplierProps {
  restaurantId: string;
  branchId: string;
  name: string;
  contact: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Supplier (catalog, soft-delete; tenant-scoped). Simple CRUD. */
export class Supplier extends Entity<string> {
  private props: SupplierProps;

  private constructor(id: string, props: SupplierProps) {
    super(id);
    this.props = props;
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    name: string;
    contact?: string | null;
    note?: string | null;
  }): Supplier {
    const now = new Date();
    return new Supplier(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      contact: input.contact ?? null,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: SupplierProps): Supplier {
    return new Supplier(id, props);
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
  get contact(): string | null {
    return this.props.contact;
  }
  get note(): string | null {
    return this.props.note;
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

  update(input: { name?: string; contact?: string | null; note?: string | null }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.contact !== undefined) this.props.contact = input.contact;
    if (input.note !== undefined) this.props.note = input.note;
    this.props.updatedAt = new Date();
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.props.updatedAt = new Date();
  }
}
