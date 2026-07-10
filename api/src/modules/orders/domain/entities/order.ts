import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import {
  DiscountType,
  OrderItemStatus,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  TERMINAL_ORDER_STATUSES,
} from '../enums';
import {
  DiscountAppliedEvent,
  OrderCancelledEvent,
  OrderCreatedEvent,
  OrderItemCancelledEvent,
  OrderClosedEvent,
  OrderItemsSentToKitchenEvent,
  OrderItemStatusChangedEvent,
  OrderReadyEvent,
  OrderServedEvent,
  OrderSplitEvent,
  PaymentRecordedEvent,
  PaymentVoidedEvent,
  SentItemInfo,
} from '../events/order-events';
import { computeTotals } from '../money';
import { isValidOrderItemTransition, isValidOrderTransition } from '../order-state.policy';
import {
  CancelReasonRequiredError,
  InvalidOrderItemTransitionError,
  InvalidOrderTransitionError,
  NoItemsToSendError,
  OrderAlreadyPaidError,
  OrderItemNotEditableError,
  OrderItemNotFoundError,
  OrderNotMutableError,
  OrderNotPaidError,
  PaymentExceedsRemainingError,
  PrepaymentNotSettledError,
  PaymentNotActiveError,
  PaymentNotFoundError,
  SplitItemNotEligibleError,
  SplitItemsRequiredError,
} from '../orders.errors';
import { OrderItem } from './order-item';
import { OrderItemModifier } from './order-item-modifier';
import { Payment } from './payment';

export interface OrderProps {
  restaurantId: string;
  branchId: string;
  orderNumber: number;
  type: OrderType;
  tableId: string | null;
  /** ORDER-2: the PREPAYMENT ordering container this order is attached to. */
  tableSessionId: string | null;
  /** ORDER-2: null for a QR-web (customer-placed) order; set for staff orders. */
  waiterId: string | null;
  /** ORDER-4: the CX-2 consumer who placed this order via the app; null otherwise. */
  consumerId: string | null;
  status: OrderStatus;
  currency: string;
  subtotalAmount: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountAmount: number;
  discountApprovedByUserId: string | null;
  serviceFeeAmount: number;
  totalAmount: number;
  note: string | null;
  cancelledReason: string | null;
  cancelledByUserId: string | null;
  cancelApprovedByUserId: string | null;
  closedAt: Date | null;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  splitFromOrderId: string | null;
  // ── ORDER-2 fiscal-aware tender split (integer minor units) ──────────────
  cardAmount: number;
  cashAmount: number;
  partialAmount: number;
  prePaymentAmount: number;
  changeAmount: number;
  partnerTin: string | null;
  paymentReference: string | null;
  // ── ORDER-2 fiscal result (null until fiscalised) ────────────────────────
  fiscalReceiptId: string | null;
  fiscalNumber: string | null;
  fiscalQr: string | null;
  fiscalizedAt: Date | null;
  // FISCAL-0: fatal-config fiscal error marker (SRC code), or null = none.
  fiscalError: string | null;
  items: OrderItem[];
  payments: Payment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderInput {
  id: string;
  restaurantId: string;
  branchId: string;
  type: OrderType;
  tableId?: string | null;
  /** ORDER-2: the attached PREPAYMENT session (QR-web). Optional for staff orders. */
  tableSessionId?: string | null;
  /** Null for a QR-web customer order; required for staff-placed orders. */
  waiterId: string | null;
  /** ORDER-4: the app consumer who placed this order. Null for QR-web/staff. */
  consumerId?: string | null;
  currency: string;
  splitFromOrderId?: string | null;
}

/**
 * Order aggregate root. OrderItem + OrderItemModifier live inside its boundary
 * (persisted together). Totals = subtotal - discount + serviceFee. NO TAX.
 * Mutating methods that affect money take `serviceFeeRateBps` and recompute.
 */
export class Order extends AggregateRoot<string> {
  private props: OrderProps;

  private constructor(id: string, props: OrderProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateOrderInput): Order {
    const now = new Date();
    return new Order(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      orderNumber: 0,
      type: input.type,
      tableId: input.tableId ?? null,
      tableSessionId: input.tableSessionId ?? null,
      waiterId: input.waiterId,
      consumerId: input.consumerId ?? null,
      status: OrderStatus.DRAFT,
      currency: input.currency,
      subtotalAmount: 0,
      discountType: null,
      discountValue: null,
      discountAmount: 0,
      discountApprovedByUserId: null,
      serviceFeeAmount: 0,
      totalAmount: 0,
      note: null,
      cancelledReason: null,
      cancelledByUserId: null,
      cancelApprovedByUserId: null,
      closedAt: null,
      paymentStatus: PaymentStatus.UNPAID,
      paidAmount: 0,
      splitFromOrderId: input.splitFromOrderId ?? null,
      cardAmount: 0,
      cashAmount: 0,
      partialAmount: 0,
      prePaymentAmount: 0,
      changeAmount: 0,
      partnerTin: null,
      paymentReference: null,
      fiscalReceiptId: null,
      fiscalNumber: null,
      fiscalQr: null,
      fiscalizedAt: null,
      fiscalError: null,
      items: [],
      payments: [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: OrderProps): Order {
    return new Order(id, props);
  }

  // ── getters ────────────────────────────────────────────────────────────
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get orderNumber(): number {
    return this.props.orderNumber;
  }
  get type(): OrderType {
    return this.props.type;
  }
  get tableId(): string | null {
    return this.props.tableId;
  }
  get tableSessionId(): string | null {
    return this.props.tableSessionId;
  }
  get waiterId(): string | null {
    return this.props.waiterId;
  }
  get consumerId(): string | null {
    return this.props.consumerId;
  }
  get status(): OrderStatus {
    return this.props.status;
  }
  get currency(): string {
    return this.props.currency;
  }
  get subtotalAmount(): number {
    return this.props.subtotalAmount;
  }
  get discountType(): DiscountType | null {
    return this.props.discountType;
  }
  get discountValue(): number | null {
    return this.props.discountValue;
  }
  get discountAmount(): number {
    return this.props.discountAmount;
  }
  get discountApprovedByUserId(): string | null {
    return this.props.discountApprovedByUserId;
  }
  get serviceFeeAmount(): number {
    return this.props.serviceFeeAmount;
  }
  get totalAmount(): number {
    return this.props.totalAmount;
  }
  get note(): string | null {
    return this.props.note;
  }
  get cancelledReason(): string | null {
    return this.props.cancelledReason;
  }
  get cancelledByUserId(): string | null {
    return this.props.cancelledByUserId;
  }
  get cancelApprovedByUserId(): string | null {
    return this.props.cancelApprovedByUserId;
  }
  get closedAt(): Date | null {
    return this.props.closedAt;
  }
  get paymentStatus(): PaymentStatus {
    return this.props.paymentStatus;
  }
  get paidAmount(): number {
    return this.props.paidAmount;
  }
  get splitFromOrderId(): string | null {
    return this.props.splitFromOrderId;
  }
  get cardAmount(): number {
    return this.props.cardAmount;
  }
  get cashAmount(): number {
    return this.props.cashAmount;
  }
  get partialAmount(): number {
    return this.props.partialAmount;
  }
  get prePaymentAmount(): number {
    return this.props.prePaymentAmount;
  }
  get changeAmount(): number {
    return this.props.changeAmount;
  }
  get partnerTin(): string | null {
    return this.props.partnerTin;
  }
  get paymentReference(): string | null {
    return this.props.paymentReference;
  }
  get fiscalReceiptId(): string | null {
    return this.props.fiscalReceiptId;
  }
  get fiscalNumber(): string | null {
    return this.props.fiscalNumber;
  }
  get fiscalQr(): string | null {
    return this.props.fiscalQr;
  }
  get fiscalizedAt(): Date | null {
    return this.props.fiscalizedAt;
  }
  get fiscalError(): string | null {
    return this.props.fiscalError;
  }
  isFiscalized(): boolean {
    return this.props.fiscalizedAt !== null;
  }
  /** FISCAL-0: a fatal-config fiscal error is recorded — do NOT re-attempt fiscalization. */
  hasFatalFiscalError(): boolean {
    return this.props.fiscalError !== null;
  }
  /**
   * FISCAL-1b: derived fiscal display state for read models. Null until the order
   * is PAID (nothing to fiscalise yet). Once PAID: FAILED if a fatal-config error
   * is recorded, OK once a receipt exists, else PENDING (paid-but-unfiscalised,
   * still retrying). OK and FAILED are mutually exclusive.
   */
  fiscalStatus(): 'OK' | 'PENDING' | 'FAILED' | null {
    if (this.props.paymentStatus !== PaymentStatus.PAID) {
      return null;
    }
    if (this.props.fiscalError !== null) {
      return 'FAILED';
    }
    if (this.props.fiscalizedAt !== null) {
      return 'OK';
    }
    return 'PENDING';
  }
  get items(): OrderItem[] {
    return [...this.props.items];
  }
  get payments(): Payment[] {
    return [...this.props.payments];
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  findItem(itemId: string): OrderItem | undefined {
    return this.props.items.find((i) => i.id === itemId);
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private assertNotTerminal(): void {
    if (TERMINAL_ORDER_STATUSES.has(this.props.status)) {
      throw new OrderNotMutableError(
        `Order is ${this.props.status} and can no longer be modified.`,
      );
    }
  }

  /** Set the gapless order number (assigned once, by the repo's create tx). Raises OrderCreated. */
  assignOrderNumber(orderNumber: number): void {
    if (this.props.orderNumber !== 0) {
      return;
    }
    this.props.orderNumber = orderNumber;
    this.addDomainEvent(
      new OrderCreatedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        orderNumber,
        this.props.tableId,
      ),
    );
  }

  /** Recompute subtotal/discount/serviceFee/total. Called after every mutation. */
  recomputeTotals(serviceFeeRateBps: number): void {
    const subtotal = this.props.items
      .filter((i) => !i.isCancelled())
      .reduce((sum, i) => sum + i.lineTotalAmount, 0);
    const totals = computeTotals(
      subtotal,
      this.props.discountType,
      this.props.discountValue,
      serviceFeeRateBps,
    );
    this.props.subtotalAmount = totals.subtotalAmount;
    this.props.discountAmount = totals.discountAmount;
    this.props.serviceFeeAmount = totals.serviceFeeAmount;
    this.props.totalAmount = totals.totalAmount;
    this.recomputePaymentStatus();
    this.touch();
  }

  addItem(item: OrderItem, serviceFeeRateBps: number): void {
    if (
      this.props.status !== OrderStatus.DRAFT &&
      this.props.status !== OrderStatus.SENT_TO_KITCHEN
    ) {
      throw new OrderNotMutableError('Items can only be added while DRAFT or SENT_TO_KITCHEN.');
    }
    this.props.items.push(item);
    this.recomputeTotals(serviceFeeRateBps);
  }

  editItem(
    itemId: string,
    input: { quantity?: number; note?: string | null; modifiers?: OrderItemModifier[] },
    serviceFeeRateBps: number,
  ): void {
    this.assertNotTerminal();
    const item = this.findItem(itemId);
    if (!item || !item.isNew()) {
      throw new OrderItemNotEditableError();
    }
    item.edit(input);
    this.recomputeTotals(serviceFeeRateBps);
  }

  removeItem(itemId: string, serviceFeeRateBps: number): void {
    this.assertNotTerminal();
    const item = this.findItem(itemId);
    if (!item || !item.isNew()) {
      throw new OrderItemNotEditableError();
    }
    this.props.items = this.props.items.filter((i) => i.id !== itemId);
    this.recomputeTotals(serviceFeeRateBps);
  }

  sendToKitchen(now: Date = new Date()): void {
    this.assertNotTerminal();
    const newItems = this.props.items.filter((i) => i.status === OrderItemStatus.NEW);
    if (newItems.length === 0) {
      throw new NoItemsToSendError();
    }
    const sent: SentItemInfo[] = [];
    for (const item of newItems) {
      item.markSent(now);
      sent.push({
        orderItemId: item.id,
        menuItemId: item.menuItemId,
        nameSnapshot: item.nameSnapshot,
        preparationStation: item.preparationStation,
        quantity: item.quantity,
        modifierOptionIds: item.modifiers
          .map((m) => m.modifierOptionId)
          .filter((id): id is string => id !== null),
      });
    }
    if (this.props.status === OrderStatus.DRAFT) {
      this.transitionTo(OrderStatus.SENT_TO_KITCHEN);
    }
    this.touch();
    this.addDomainEvent(
      new OrderItemsSentToKitchenEvent(this.id, this.props.restaurantId, this.props.branchId, sent),
    );
  }

  markServed(): void {
    this.transitionTo(OrderStatus.SERVED);
    this.touch();
    this.addDomainEvent(new OrderServedEvent(this.id, this.props.restaurantId));
  }

  applyDiscount(
    type: DiscountType,
    value: number,
    approvedByUserId: string | null,
    serviceFeeRateBps: number,
    actorUserId: string | null = null,
  ): void {
    this.assertNotTerminal();
    this.props.discountType = type;
    this.props.discountValue = value;
    this.props.discountApprovedByUserId = approvedByUserId;
    this.recomputeTotals(serviceFeeRateBps);
    this.addDomainEvent(
      new DiscountAppliedEvent(
        this.id,
        this.props.restaurantId,
        this.props.discountAmount,
        actorUserId,
      ),
    );
  }

  removeDiscount(serviceFeeRateBps: number): void {
    this.assertNotTerminal();
    this.props.discountType = null;
    this.props.discountValue = null;
    this.props.discountApprovedByUserId = null;
    this.recomputeTotals(serviceFeeRateBps);
  }

  cancelItem(
    itemId: string,
    reason: string,
    serviceFeeRateBps: number,
    actorUserId: string | null = null,
  ): void {
    this.assertNotTerminal();
    if (!reason || reason.trim().length === 0) {
      throw new CancelReasonRequiredError();
    }
    const item = this.findItem(itemId);
    if (!item) {
      throw new OrderItemNotEditableError();
    }
    const station = item.preparationStation;
    item.cancel(reason);
    this.recomputeTotals(serviceFeeRateBps);
    this.addDomainEvent(
      new OrderItemCancelledEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        itemId,
        station,
        reason,
        actorUserId,
      ),
    );
  }

  cancel(reason: string, cancelledByUserId: string, cancelApprovedByUserId: string | null): void {
    if (!reason || reason.trim().length === 0) {
      throw new CancelReasonRequiredError();
    }
    // Capture lines that were live on a station BEFORE the transition so the
    // inventory listener can reverse their consumption (INV-3).
    const sentOrderItemIds = this.props.items.filter((i) => i.isActiveOnStation()).map((i) => i.id);
    this.transitionTo(OrderStatus.CANCELLED);
    this.props.cancelledReason = reason;
    this.props.cancelledByUserId = cancelledByUserId;
    this.props.cancelApprovedByUserId = cancelApprovedByUserId;
    this.touch();
    this.addDomainEvent(
      new OrderCancelledEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        reason,
        cancelledByUserId,
        sentOrderItemIds,
      ),
    );
  }

  moveToTable(newTableId: string): void {
    this.assertNotTerminal();
    this.props.tableId = newTableId;
    this.touch();
  }

  setNote(note: string | null): void {
    this.assertNotTerminal();
    this.props.note = note;
    this.touch();
  }

  // ── checkout: payments ──────────────────────────────────────────────────

  findPayment(paymentId: string): Payment | undefined {
    return this.props.payments.find((p) => p.id === paymentId);
  }

  /** Remaining balance = total - paidAmount (paidAmount = sum of ACTIVE payments). */
  remainingAmount(): number {
    return this.props.totalAmount - this.props.paidAmount;
  }

  /**
   * Record a manual payment. Rejects on CLOSED/CANCELLED orders, non-positive
   * amounts, and amounts exceeding the remaining balance. Recomputes
   * paidAmount + paymentStatus. Returns the created Payment.
   */
  recordPayment(input: {
    id: string;
    method: PaymentMethod;
    amount: number;
    tenderedAmount?: number | null;
    /** Null for a gateway-processed QR prepayment (no staff user). */
    processedByUserId: string | null;
  }): Payment {
    this.assertNotTerminal();
    const remaining = this.remainingAmount();
    if (input.amount > remaining) {
      throw new PaymentExceedsRemainingError(remaining);
    }
    const payment = Payment.create({
      id: input.id,
      restaurantId: this.props.restaurantId,
      branchId: this.props.branchId, // payments inherit the order's branch
      orderId: this.id,
      method: input.method,
      amount: input.amount,
      tenderedAmount: input.tenderedAmount ?? null,
      processedByUserId: input.processedByUserId,
    });
    this.props.payments.push(payment);
    this.recomputePaymentStatus();
    this.touch();
    this.addDomainEvent(
      new PaymentRecordedEvent(
        this.id,
        this.props.restaurantId,
        payment.id,
        payment.amount,
        this.props.paymentStatus,
        input.processedByUserId,
      ),
    );
    return payment;
  }

  /** Void an ACTIVE payment on a non-terminal order; recomputes payment status. */
  voidPayment(paymentId: string, reason: string | null, voidedByUserId: string): Payment {
    this.assertNotTerminal();
    const payment = this.findPayment(paymentId);
    if (!payment) {
      throw new PaymentNotFoundError();
    }
    if (!payment.isActive()) {
      throw new PaymentNotActiveError();
    }
    payment.void(reason, voidedByUserId);
    this.recomputePaymentStatus();
    this.touch();
    this.addDomainEvent(
      new PaymentVoidedEvent(this.id, this.props.restaurantId, payment.id, reason ?? null),
    );
    return payment;
  }

  /** Close the bill. Requires paymentStatus === PAID. Terminal. */
  close(now: Date = new Date(), actorUserId: string | null = null): void {
    this.assertNotTerminal();
    if (this.props.paymentStatus !== PaymentStatus.PAID) {
      throw new OrderNotPaidError();
    }
    this.props.status = OrderStatus.CLOSED;
    this.props.closedAt = now;
    this.touch();
    this.addDomainEvent(
      new OrderClosedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.tableId,
        actorUserId,
      ),
    );
  }

  // ── ORDER-2: QR-web prepayment settlement + fiscalization ────────────────

  /**
   * Settle a QR-web prepayment IN FULL (card only, v1). Records a gateway-
   * processed CARD payment (no staff user), fills the fiscal tender split, and
   * stores the gateway reference. Requires a fresh, unpaid, non-terminal order;
   * on success paymentStatus becomes PAID (via recomputePaymentStatus).
   */
  settlePrepaymentCard(input: { paymentId: string; amount: number; paymentReference: string }): Payment {
    this.assertNotTerminal();
    if (this.props.paymentStatus === PaymentStatus.PAID) {
      throw new OrderAlreadyPaidError();
    }
    const payment = this.recordPayment({
      id: input.paymentId,
      method: PaymentMethod.CARD,
      amount: input.amount,
      tenderedAmount: null,
      processedByUserId: null,
    });
    // Tender split: card only. Products-mode receipt → prePayment 0, no change.
    this.props.cardAmount = input.amount;
    this.props.cashAmount = 0;
    this.props.partialAmount = 0;
    this.props.prePaymentAmount = 0;
    this.props.changeAmount = 0;
    this.props.paymentReference = input.paymentReference;
    this.touch();
    return payment;
  }

  /**
   * Persist the fiscal result onto the order. IDEMPOTENT: a no-op once already
   * fiscalised, so a retried confirm (recoverable paid-but-unfiscalized branch)
   * never overwrites or double-issues.
   */
  applyFiscalResult(result: {
    receiptId: string;
    fiscalNumber: string;
    qr: string;
    issuedAt: Date;
  }): boolean {
    if (this.isFiscalized()) {
      return false;
    }
    this.props.fiscalReceiptId = result.receiptId;
    this.props.fiscalNumber = result.fiscalNumber;
    this.props.fiscalQr = result.qr;
    this.props.fiscalizedAt = result.issuedAt;
    // FISCAL-0: a successful fiscalisation supersedes any prior fatal marker.
    this.props.fiscalError = null;
    this.touch();
    return true;
  }

  /**
   * FISCAL-0: record a FATAL-config fiscalization failure (e.g. SRC 192/403) so a
   * retried ConfirmPayment stops re-attempting and an operator can see the code.
   * No-op once fiscalised (a fatal marker never overwrites a real receipt).
   */
  markFiscalFatal(code: string): void {
    if (this.isFiscalized()) {
      return;
    }
    this.props.fiscalError = code;
    this.touch();
  }

  /**
   * ORDER-2 prepayment gate + KDS dispatch. SENT_TO_KITCHEN is unreachable until
   * paymentStatus = PAID; this reuses the existing sendToKitchen path (raises
   * OrderItemsSentToKitchenEvent → realtime relay → KDS), so there is no parallel
   * dispatch. Only valid from DRAFT; callers guard idempotency on status.
   */
  dispatchPrepaid(now: Date = new Date()): void {
    if (this.props.paymentStatus !== PaymentStatus.PAID) {
      throw new PrepaymentNotSettledError();
    }
    this.sendToKitchen(now);
  }

  /** True once the order has left DRAFT (dispatched to the kitchen or terminal). */
  hasBeenDispatched(): boolean {
    return this.props.status !== OrderStatus.DRAFT;
  }

  /** paidAmount = sum of ACTIVE payments; status derived against the current total. */
  private recomputePaymentStatus(): void {
    const paid = this.props.payments
      .filter((p) => p.isActive())
      .reduce((sum, p) => sum + p.amount, 0);
    this.props.paidAmount = paid;
    if (paid <= 0) {
      this.props.paymentStatus = PaymentStatus.UNPAID;
    } else if (paid >= this.props.totalAmount) {
      this.props.paymentStatus = PaymentStatus.PAID;
    } else {
      this.props.paymentStatus = PaymentStatus.PARTIALLY_PAID;
    }
  }

  // ── checkout: split ─────────────────────────────────────────────────────

  /**
   * Move the given non-cancelled items (with their modifier snapshots) out of
   * this order into a NEW linked child check (splitFromOrderId = this.id, same
   * table). Both orders recompute. Child status derives from the moved items:
   * all NEW -> DRAFT, any already SENT -> SENT_TO_KITCHEN. The repository assigns
   * the child's gapless order number on create. Returns the new check.
   */
  splitItemsToNewCheck(newOrderId: string, itemIds: string[], serviceFeeRateBps: number): Order {
    this.assertNotTerminal();
    if (!itemIds || itemIds.length === 0) {
      throw new SplitItemsRequiredError();
    }
    const unique = [...new Set(itemIds)];
    const moved: OrderItem[] = [];
    for (const id of unique) {
      const item = this.findItem(id);
      if (!item || item.isCancelled()) {
        throw new SplitItemNotEligibleError(id);
      }
      moved.push(item);
    }
    const movedIds = new Set(moved.map((i) => i.id));
    this.props.items = this.props.items.filter((i) => !movedIds.has(i.id));

    const childStatus = moved.some((i) => i.status !== OrderItemStatus.NEW)
      ? OrderStatus.SENT_TO_KITCHEN
      : OrderStatus.DRAFT;
    const now = new Date();
    const child = new Order(newOrderId, {
      restaurantId: this.props.restaurantId,
      branchId: this.props.branchId,
      orderNumber: 0,
      type: this.props.type,
      tableId: this.props.tableId,
      tableSessionId: this.props.tableSessionId,
      waiterId: this.props.waiterId,
      consumerId: this.props.consumerId, // split inherits the placing consumer
      status: childStatus,
      currency: this.props.currency,
      subtotalAmount: 0,
      discountType: null,
      discountValue: null,
      discountAmount: 0,
      discountApprovedByUserId: null,
      serviceFeeAmount: 0,
      totalAmount: 0,
      note: null,
      cancelledReason: null,
      cancelledByUserId: null,
      cancelApprovedByUserId: null,
      closedAt: null,
      paymentStatus: PaymentStatus.UNPAID,
      paidAmount: 0,
      splitFromOrderId: this.id,
      cardAmount: 0,
      cashAmount: 0,
      partialAmount: 0,
      prePaymentAmount: 0,
      changeAmount: 0,
      partnerTin: null,
      paymentReference: null,
      fiscalReceiptId: null,
      fiscalNumber: null,
      fiscalQr: null,
      fiscalizedAt: null,
      fiscalError: null,
      items: moved,
      payments: [],
      createdAt: now,
      updatedAt: now,
    });
    child.recomputeTotals(serviceFeeRateBps);
    this.recomputeTotals(serviceFeeRateBps);
    this.addDomainEvent(
      new OrderSplitEvent(this.id, this.props.restaurantId, child.id, [...movedIds]),
    );
    return child;
  }

  // ── KDS-driven item transitions ──────────────────────────────────

  /** KDS: move a SENT item to PREPARING; recompute order status. */
  markItemPreparing(itemId: string): void {
    this.assertNotTerminal();
    const item = this.findItem(itemId);
    if (!item) {
      throw new OrderItemNotFoundError();
    }
    if (!isValidOrderItemTransition(item.status, OrderItemStatus.PREPARING)) {
      throw new InvalidOrderItemTransitionError(item.status, OrderItemStatus.PREPARING);
    }
    item.markPreparing(new Date());
    this.recomputeKitchenStatus();
    this.addDomainEvent(
      new OrderItemStatusChangedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        item.id,
        item.preparationStation,
        item.status,
        this.props.status,
      ),
    );
    this.touch();
  }

  /** KDS: move a SENT/PREPARING item to READY; recompute order status, raise OrderReady if applicable. */
  markItemReady(itemId: string): void {
    this.assertNotTerminal();
    const item = this.findItem(itemId);
    if (!item) {
      throw new OrderItemNotFoundError();
    }
    if (!isValidOrderItemTransition(item.status, OrderItemStatus.READY)) {
      throw new InvalidOrderItemTransitionError(item.status, OrderItemStatus.READY);
    }
    const before = this.props.status;
    item.markReady(new Date());
    this.recomputeKitchenStatus();
    this.addDomainEvent(
      new OrderItemStatusChangedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        item.id,
        item.preparationStation,
        item.status,
        this.props.status,
      ),
    );
    if (before !== OrderStatus.READY && this.props.status === OrderStatus.READY) {
      this.addDomainEvent(
        new OrderReadyEvent(
          this.id,
          this.props.restaurantId,
          this.props.branchId,
          this.props.tableId,
        ),
      );
    }
    this.touch();
  }

  /** KDS: mark the whole order READY — all live station items become READY. */
  markReady(): void {
    this.assertNotTerminal();
    const station = this.props.items.filter((i) => i.isActiveOnStation());
    if (station.length === 0) {
      throw new NoItemsToSendError();
    }
    const before = this.props.status;
    const now = new Date();
    const changed = station.filter((i) => i.status !== OrderItemStatus.READY);
    for (const item of changed) {
      item.markReady(now);
    }
    this.recomputeKitchenStatus();
    for (const item of changed) {
      this.addDomainEvent(
        new OrderItemStatusChangedEvent(
          this.id,
          this.props.restaurantId,
          this.props.branchId,
          item.id,
          item.preparationStation,
          item.status,
          this.props.status,
        ),
      );
    }
    if (before !== OrderStatus.READY && this.props.status === OrderStatus.READY) {
      this.addDomainEvent(
        new OrderReadyEvent(
          this.id,
          this.props.restaurantId,
          this.props.branchId,
          this.props.tableId,
        ),
      );
    }
    this.touch();
  }

  /**
   * Derive the ORDER status from its live station items (KDS phase only):
   *   all SENT -> SENT_TO_KITCHEN; any progress -> PREPARING; all READY -> READY.
   * No-op outside the kitchen phase (DRAFT / SERVED / CLOSED / CANCELLED).
   */
  private recomputeKitchenStatus(): void {
    const cur = this.props.status;
    if (
      cur !== OrderStatus.SENT_TO_KITCHEN &&
      cur !== OrderStatus.PREPARING &&
      cur !== OrderStatus.READY
    ) {
      return;
    }
    const station = this.props.items.filter((i) => i.isActiveOnStation());
    if (station.length === 0) {
      return;
    }
    if (station.every((i) => i.status === OrderItemStatus.READY)) {
      this.props.status = OrderStatus.READY;
    } else if (
      station.some(
        (i) => i.status === OrderItemStatus.PREPARING || i.status === OrderItemStatus.READY,
      )
    ) {
      this.props.status = OrderStatus.PREPARING;
    } else {
      this.props.status = OrderStatus.SENT_TO_KITCHEN;
    }
  }

  private transitionTo(target: OrderStatus): void {
    if (!isValidOrderTransition(this.props.status, target)) {
      throw new InvalidOrderTransitionError(this.props.status, target);
    }
    this.props.status = target;
  }
}
