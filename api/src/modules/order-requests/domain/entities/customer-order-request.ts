import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { CustomerOrderRequestStatus } from '../enums';
import {
  OrderRequestConfirmedEvent,
  OrderRequestCreatedEvent,
  OrderRequestRejectedEvent,
} from '../events/order-request-events';
import { EmptyRequestError, RequestNotPendingError } from '../order-requests.errors';
import { RequestItem } from './request-item';

export interface CustomerOrderRequestProps {
  restaurantId: string;
  tableId: string;
  customerName: string | null;
  note: string | null;
  status: CustomerOrderRequestStatus;
  linkedOrderId: string | null;
  rejectedReason: string | null;
  handledByUserId: string | null;
  handledAt: Date | null;
  items: RequestItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerOrderRequestInput {
  id: string;
  restaurantId: string;
  tableId: string;
  customerName?: string | null;
  note?: string | null;
  items: RequestItem[];
}

/**
 * CustomerOrderRequest aggregate. Customers create a PENDING request (items +
 * modifiers snapshotted within the boundary). Staff confirm (-> a real order) or
 * reject. Only a PENDING request can be confirmed/rejected.
 */
export class CustomerOrderRequest extends AggregateRoot<string> {
  private props: CustomerOrderRequestProps;

  private constructor(id: string, props: CustomerOrderRequestProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateCustomerOrderRequestInput): CustomerOrderRequest {
    if (!input.items || input.items.length === 0) {
      throw new EmptyRequestError();
    }
    const now = new Date();
    const request = new CustomerOrderRequest(input.id, {
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      customerName: input.customerName ?? null,
      note: input.note ?? null,
      status: CustomerOrderRequestStatus.PENDING,
      linkedOrderId: null,
      rejectedReason: null,
      handledByUserId: null,
      handledAt: null,
      items: input.items,
      createdAt: now,
      updatedAt: now,
    });
    request.addDomainEvent(
      new OrderRequestCreatedEvent(
        request.id,
        input.restaurantId,
        input.tableId,
        request.props.status,
      ),
    );
    return request;
  }

  static reconstitute(id: string, props: CustomerOrderRequestProps): CustomerOrderRequest {
    return new CustomerOrderRequest(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get tableId(): string {
    return this.props.tableId;
  }
  get customerName(): string | null {
    return this.props.customerName;
  }
  get note(): string | null {
    return this.props.note;
  }
  get status(): CustomerOrderRequestStatus {
    return this.props.status;
  }
  get linkedOrderId(): string | null {
    return this.props.linkedOrderId;
  }
  get rejectedReason(): string | null {
    return this.props.rejectedReason;
  }
  get handledByUserId(): string | null {
    return this.props.handledByUserId;
  }
  get handledAt(): Date | null {
    return this.props.handledAt;
  }
  get items(): RequestItem[] {
    return [...this.props.items];
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private assertPending(): void {
    if (this.props.status !== CustomerOrderRequestStatus.PENDING) {
      throw new RequestNotPendingError();
    }
  }

  /** Confirm: link to the (created/merged) order and stamp who handled it. */
  confirm(linkedOrderId: string, userId: string, now: Date = new Date()): void {
    this.assertPending();
    this.props.status = CustomerOrderRequestStatus.CONFIRMED;
    this.props.linkedOrderId = linkedOrderId;
    this.props.handledByUserId = userId;
    this.props.handledAt = now;
    this.props.updatedAt = now;
    this.addDomainEvent(
      new OrderRequestConfirmedEvent(
        this.id,
        this.props.restaurantId,
        linkedOrderId,
        this.props.status,
      ),
    );
  }

  reject(reason: string | null, userId: string, now: Date = new Date()): void {
    this.assertPending();
    this.props.status = CustomerOrderRequestStatus.REJECTED;
    this.props.rejectedReason = reason ?? null;
    this.props.handledByUserId = userId;
    this.props.handledAt = now;
    this.props.updatedAt = now;
    this.addDomainEvent(
      new OrderRequestRejectedEvent(
        this.id,
        this.props.restaurantId,
        reason ?? null,
        this.props.status,
      ),
    );
  }
}
