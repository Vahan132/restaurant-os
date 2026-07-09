import { OrderItemStatus } from '../enums';
import { InvalidQuantityError } from '../orders.errors';
import { OrderItemModifier } from './order-item-modifier';

/** Fiscal-ready line fields (ORDER-2). goodCode/goodName/unit populated for QR
 *  lines; the rest are RESERVED nullable (no logic in v1). */
export interface OrderItemFiscalProps {
  goodCode: string | null;
  goodName: string | null;
  unit: string | null;
  adgCode: string | null;
  dep: string | null;
  discount: number | null;
  discountType: number | null;
  additionalDiscount: number | null;
  additionalDiscountType: number | null;
  emarks: string | null;
}

export interface OrderItemProps extends OrderItemFiscalProps {
  restaurantId: string;
  branchId: string;
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  unitPriceAmount: number;
  preparationStation: string;
  quantity: number;
  note: string | null;
  status: OrderItemStatus;
  lineTotalAmount: number;
  sentToKitchenAt: Date | null;
  preparingAt: Date | null;
  readyAt: Date | null;
  cancelledReason: string | null;
  modifiers: OrderItemModifier[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderItemInput {
  id: string;
  restaurantId: string;
  branchId: string;
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  unitPriceAmount: number;
  preparationStation: string;
  quantity: number;
  note?: string | null;
  modifiers: OrderItemModifier[];
  /** Fiscal snapshot (QR-web populates goodName/goodCode/unit). */
  goodCode?: string | null;
  goodName?: string | null;
  unit?: string | null;
  /** FISCAL-0: dish-level ATG code (from MenuItem.adgCode). Null until classified. */
  adgCode?: string | null;
}

/** Default (all-null) reserved fiscal fields for a freshly created line. */
const EMPTY_RESERVED_FISCAL = {
  adgCode: null,
  dep: null,
  discount: null,
  discountType: null,
  additionalDiscount: null,
  additionalDiscountType: null,
  emarks: null,
} as const;

/** Order line item (entity inside the Order aggregate). Prices are snapshotted. */
export class OrderItem {
  private constructor(
    private readonly _id: string,
    private props: OrderItemProps,
  ) {}

  static create(input: CreateOrderItemInput): OrderItem {
    OrderItem.assertQuantity(input.quantity);
    const now = new Date();
    const item = new OrderItem(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      orderId: input.orderId,
      menuItemId: input.menuItemId,
      nameSnapshot: input.nameSnapshot,
      unitPriceAmount: input.unitPriceAmount,
      preparationStation: input.preparationStation,
      quantity: input.quantity,
      note: input.note ?? null,
      status: OrderItemStatus.NEW,
      lineTotalAmount: 0,
      sentToKitchenAt: null,
      preparingAt: null,
      readyAt: null,
      cancelledReason: null,
      modifiers: input.modifiers,
      goodCode: input.goodCode ?? null,
      goodName: input.goodName ?? input.nameSnapshot,
      unit: input.unit ?? null,
      ...EMPTY_RESERVED_FISCAL,
      // FISCAL-0: snapshot the dish-level ATG code (overrides the reserved null).
      adgCode: input.adgCode ?? null,
      createdAt: now,
      updatedAt: now,
    });
    item.recomputeLineTotal();
    return item;
  }

  static reconstitute(id: string, props: OrderItemProps): OrderItem {
    return new OrderItem(id, props);
  }

  private static assertQuantity(q: number): void {
    if (!Number.isInteger(q) || q < 1) {
      throw new InvalidQuantityError();
    }
  }

  get id(): string {
    return this._id;
  }
  get menuItemId(): string {
    return this.props.menuItemId;
  }
  get nameSnapshot(): string {
    return this.props.nameSnapshot;
  }
  get unitPriceAmount(): number {
    return this.props.unitPriceAmount;
  }
  get preparationStation(): string {
    return this.props.preparationStation;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get note(): string | null {
    return this.props.note;
  }
  get status(): OrderItemStatus {
    return this.props.status;
  }
  get lineTotalAmount(): number {
    return this.props.lineTotalAmount;
  }
  get sentToKitchenAt(): Date | null {
    return this.props.sentToKitchenAt;
  }
  get preparingAt(): Date | null {
    return this.props.preparingAt;
  }
  get readyAt(): Date | null {
    return this.props.readyAt;
  }
  get cancelledReason(): string | null {
    return this.props.cancelledReason;
  }
  get modifiers(): OrderItemModifier[] {
    return [...this.props.modifiers];
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get orderId(): string {
    return this.props.orderId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ── fiscal-ready line fields (ORDER-2) ───────────────────────────────────
  get goodCode(): string | null {
    return this.props.goodCode;
  }
  get goodName(): string | null {
    return this.props.goodName;
  }
  get unit(): string | null {
    return this.props.unit;
  }
  get adgCode(): string | null {
    return this.props.adgCode;
  }
  get dep(): string | null {
    return this.props.dep;
  }
  get discount(): number | null {
    return this.props.discount;
  }
  get discountType(): number | null {
    return this.props.discountType;
  }
  get additionalDiscount(): number | null {
    return this.props.additionalDiscount;
  }
  get additionalDiscountType(): number | null {
    return this.props.additionalDiscountType;
  }
  get emarks(): string | null {
    return this.props.emarks;
  }

  isNew(): boolean {
    return this.props.status === OrderItemStatus.NEW;
  }
  isCancelled(): boolean {
    return this.props.status === OrderItemStatus.CANCELLED;
  }
  /** Sent to the kitchen and not yet served/cancelled (i.e. live on a KDS ticket). */
  isActiveOnStation(): boolean {
    return (
      this.props.status === OrderItemStatus.SENT ||
      this.props.status === OrderItemStatus.PREPARING ||
      this.props.status === OrderItemStatus.READY
    );
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /** lineTotal = (unitPrice + sum(modifier deltas)) * quantity. */
  recomputeLineTotal(): void {
    const modifiersTotal = this.props.modifiers.reduce((sum, m) => sum + m.priceDeltaAmount, 0);
    this.props.lineTotalAmount =
      (this.props.unitPriceAmount + modifiersTotal) * this.props.quantity;
  }

  edit(input: { quantity?: number; note?: string | null; modifiers?: OrderItemModifier[] }): void {
    if (input.quantity !== undefined) {
      OrderItem.assertQuantity(input.quantity);
      this.props.quantity = input.quantity;
    }
    if (input.note !== undefined) {
      this.props.note = input.note;
    }
    if (input.modifiers !== undefined) {
      this.props.modifiers = input.modifiers;
    }
    this.recomputeLineTotal();
    this.touch();
  }

  markSent(at: Date): void {
    this.props.status = OrderItemStatus.SENT;
    this.props.sentToKitchenAt = at;
    this.touch();
  }

  /** KDS: SENT -> PREPARING. Stamps preparingAt. */
  markPreparing(at: Date): void {
    this.props.status = OrderItemStatus.PREPARING;
    this.props.preparingAt = at;
    this.touch();
  }

  /** KDS: SENT/PREPARING -> READY. Stamps readyAt (and preparingAt if skipped). */
  markReady(at: Date): void {
    if (this.props.preparingAt === null) {
      this.props.preparingAt = at;
    }
    this.props.status = OrderItemStatus.READY;
    this.props.readyAt = at;
    this.touch();
  }

  cancel(reason: string): void {
    this.props.status = OrderItemStatus.CANCELLED;
    this.props.cancelledReason = reason;
    this.touch();
  }
}
