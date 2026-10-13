/**
 * ImportedSale — a single historical/external sale line (5A).
 *
 * NON-FISCAL by construction: carries NO tax, payment-state, fiscalization, or
 * inventory fields. It only ever feeds analytics. Pure domain (no framework).
 */
export interface ImportedSaleProps {
  restaurantId: string;
  branchId: string;
  importBatchId: string;
  occurredAt: Date;
  itemDescription: string;
  /** Catalog MenuItem id — set ONLY when confidently matched, else null. */
  itemId: string | null;
  quantity: number;
  /** Money in minor units (e.g. cents). */
  unitPriceAmount: number;
  /** Money in minor units (e.g. cents). */
  lineTotalAmount: number;
  paymentMethod: string | null;
  externalReference: string | null;
  createdAt: Date;
}

export class ImportedSale {
  private constructor(
    private readonly _id: string,
    private readonly props: ImportedSaleProps,
  ) {}

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    importBatchId: string;
    occurredAt: Date;
    itemDescription: string;
    itemId?: string | null;
    quantity: number;
    unitPriceAmount: number;
    lineTotalAmount: number;
    paymentMethod?: string | null;
    externalReference?: string | null;
  }): ImportedSale {
    return new ImportedSale(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      importBatchId: input.importBatchId,
      occurredAt: input.occurredAt,
      itemDescription: input.itemDescription,
      itemId: input.itemId ?? null,
      quantity: input.quantity,
      unitPriceAmount: input.unitPriceAmount,
      lineTotalAmount: input.lineTotalAmount,
      paymentMethod: input.paymentMethod ?? null,
      externalReference: input.externalReference ?? null,
      createdAt: new Date(),
    });
  }

  static reconstitute(id: string, props: ImportedSaleProps): ImportedSale {
    return new ImportedSale(id, props);
  }

  get id(): string {
    return this._id;
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get importBatchId(): string {
    return this.props.importBatchId;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
  get itemDescription(): string {
    return this.props.itemDescription;
  }
  get itemId(): string | null {
    return this.props.itemId;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get unitPriceAmount(): number {
    return this.props.unitPriceAmount;
  }
  get lineTotalAmount(): number {
    return this.props.lineTotalAmount;
  }
  get paymentMethod(): string | null {
    return this.props.paymentMethod;
  }
  get externalReference(): string | null {
    return this.props.externalReference;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
}
