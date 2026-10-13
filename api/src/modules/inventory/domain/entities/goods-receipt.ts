import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { GoodsReceiptCreatedEvent } from '../events/inventory-events';

/** A persisted goods-receipt line (already converted to base units). */
export interface GoodsReceiptLineProps {
  id: string;
  branchId: string;
  itemId: string;
  enteredUnit: string;
  enteredQty: number;
  baseQty: number;
  lineTotalCostAmount: number;
  expiryDate: Date | null;
}

export class GoodsReceiptLine {
  constructor(private readonly props: GoodsReceiptLineProps) {}

  get id(): string {
    return this.props.id;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get enteredUnit(): string {
    return this.props.enteredUnit;
  }
  get enteredQty(): number {
    return this.props.enteredQty;
  }
  get baseQty(): number {
    return this.props.baseQty;
  }
  get lineTotalCostAmount(): number {
    return this.props.lineTotalCostAmount;
  }
  get expiryDate(): Date | null {
    return this.props.expiryDate;
  }
}

export interface GoodsReceiptProps {
  restaurantId: string;
  branchId: string;
  supplierId: string | null;
  reference: string | null;
  receivedAt: Date;
  note: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  lines: GoodsReceiptLine[];
}

/** GoodsReceipt aggregate (operational; tenant-scoped). One layer is created per line. */
export class GoodsReceipt extends AggregateRoot<string> {
  private props: GoodsReceiptProps;

  private constructor(id: string, props: GoodsReceiptProps) {
    super(id);
    this.props = props;
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    supplierId?: string | null;
    reference?: string | null;
    receivedAt: Date;
    note?: string | null;
    createdByUserId: string;
    lines: GoodsReceiptLine[];
  }): GoodsReceipt {
    const now = new Date();
    const receipt = new GoodsReceipt(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      supplierId: input.supplierId ?? null,
      reference: input.reference ?? null,
      receivedAt: input.receivedAt,
      note: input.note ?? null,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
      lines: input.lines,
    });
    receipt.addDomainEvent(
      new GoodsReceiptCreatedEvent(
        input.id,
        input.restaurantId,
        input.lines.length,
        input.createdByUserId,
      ),
    );
    return receipt;
  }

  static reconstitute(id: string, props: GoodsReceiptProps): GoodsReceipt {
    return new GoodsReceipt(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get supplierId(): string | null {
    return this.props.supplierId;
  }
  get reference(): string | null {
    return this.props.reference;
  }
  get receivedAt(): Date {
    return this.props.receivedAt;
  }
  get note(): string | null {
    return this.props.note;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get lines(): GoodsReceiptLine[] {
    return this.props.lines;
  }
}
