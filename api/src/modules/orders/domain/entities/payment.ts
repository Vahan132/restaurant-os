import { PaymentMethod, PaymentState } from '../enums';
import { PaymentAmountInvalidError } from '../orders.errors';

export interface PaymentProps {
  restaurantId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  tenderedAmount: number | null;
  state: PaymentState;
  processedByUserId: string;
  voidedByUserId: string | null;
  voidedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentInput {
  id: string;
  restaurantId: string;
  orderId: string;
  method: PaymentMethod;
  amount: number;
  tenderedAmount?: number | null;
  processedByUserId: string;
}

/**
 * Payment entity — lives inside the Order aggregate boundary (persisted with the
 * order). Manual tracking only (record method + amount; NO processing). Integer
 * minor units; amount must be > 0. `tenderedAmount` (cash) is for change display
 * only — change is computed, never stored.
 */
export class Payment {
  private constructor(
    private readonly _id: string,
    private props: PaymentProps,
  ) {}

  static create(input: CreatePaymentInput): Payment {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new PaymentAmountInvalidError();
    }
    if (
      input.tenderedAmount !== undefined &&
      input.tenderedAmount !== null &&
      (!Number.isInteger(input.tenderedAmount) || input.tenderedAmount < input.amount)
    ) {
      throw new PaymentAmountInvalidError(
        'Tendered amount must be an integer >= the payment amount.',
      );
    }
    const now = new Date();
    return new Payment(input.id, {
      restaurantId: input.restaurantId,
      orderId: input.orderId,
      method: input.method,
      amount: input.amount,
      tenderedAmount: input.tenderedAmount ?? null,
      state: PaymentState.ACTIVE,
      processedByUserId: input.processedByUserId,
      voidedByUserId: null,
      voidedReason: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: PaymentProps): Payment {
    return new Payment(id, props);
  }

  get id(): string {
    return this._id;
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get orderId(): string {
    return this.props.orderId;
  }
  get method(): PaymentMethod {
    return this.props.method;
  }
  get amount(): number {
    return this.props.amount;
  }
  get tenderedAmount(): number | null {
    return this.props.tenderedAmount;
  }
  get state(): PaymentState {
    return this.props.state;
  }
  get processedByUserId(): string {
    return this.props.processedByUserId;
  }
  get voidedByUserId(): string | null {
    return this.props.voidedByUserId;
  }
  get voidedReason(): string | null {
    return this.props.voidedReason;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isActive(): boolean {
    return this.props.state === PaymentState.ACTIVE;
  }

  /** Cash change = tendered - amount (>= 0). 0 when no tendered amount recorded. */
  changeAmount(): number {
    if (this.props.tenderedAmount === null) {
      return 0;
    }
    return Math.max(0, this.props.tenderedAmount - this.props.amount);
  }

  void(reason: string | null, voidedByUserId: string): void {
    this.props.state = PaymentState.VOIDED;
    this.props.voidedReason = reason ?? null;
    this.props.voidedByUserId = voidedByUserId;
    this.props.updatedAt = new Date();
  }
}
