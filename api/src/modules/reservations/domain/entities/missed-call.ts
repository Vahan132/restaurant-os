import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { MissedCallStatus } from '../enums';
import { MissedCallCreatedEvent } from '../events/missed-call-events';

export interface MissedCallProps {
  restaurantId: string;
  branchId: string;
  deviceId: string;
  phoneNumber: string;
  callerName: string | null;
  occurredAt: Date;
  status: MissedCallStatus;
  handledByUserId: string | null;
  linkedReservationId: string | null;
  dedupeKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMissedCallInput {
  id: string;
  restaurantId: string;
  branchId: string;
  deviceId: string;
  phoneNumber: string;
  callerName?: string | null;
  occurredAt: Date;
  dedupeKey: string;
}

/**
 * MissedCall aggregate. Recorded by a companion device as status NEW; staff then
 * handle, dismiss, or convert it into a reservation (which links + marks HANDLED).
 * Transitions are forgiving (idempotent inbox actions) — there is no strict state
 * machine here, unlike the Reservation aggregate.
 */
export class MissedCall extends AggregateRoot<string> {
  private props: MissedCallProps;

  private constructor(id: string, props: MissedCallProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateMissedCallInput): MissedCall {
    const now = new Date();
    const call = new MissedCall(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      deviceId: input.deviceId,
      phoneNumber: input.phoneNumber,
      callerName: input.callerName ?? null,
      occurredAt: input.occurredAt,
      status: MissedCallStatus.NEW,
      handledByUserId: null,
      linkedReservationId: null,
      dedupeKey: input.dedupeKey,
      createdAt: now,
      updatedAt: now,
    });
    call.addDomainEvent(
      new MissedCallCreatedEvent(
        call.id,
        input.restaurantId,
        input.branchId,
        input.phoneNumber,
        input.occurredAt,
      ),
    );
    return call;
  }

  static reconstitute(id: string, props: MissedCallProps): MissedCall {
    return new MissedCall(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get deviceId(): string {
    return this.props.deviceId;
  }
  get phoneNumber(): string {
    return this.props.phoneNumber;
  }
  get callerName(): string | null {
    return this.props.callerName;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
  get status(): MissedCallStatus {
    return this.props.status;
  }
  get handledByUserId(): string | null {
    return this.props.handledByUserId;
  }
  get linkedReservationId(): string | null {
    return this.props.linkedReservationId;
  }
  get dedupeKey(): string {
    return this.props.dedupeKey;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  handle(userId: string): void {
    this.props.status = MissedCallStatus.HANDLED;
    this.props.handledByUserId = userId;
    this.touch();
  }

  dismiss(userId: string | null = null): void {
    this.props.status = MissedCallStatus.DISMISSED;
    this.props.handledByUserId = userId;
    this.touch();
  }

  /** Link a created reservation and mark the call HANDLED. */
  linkReservation(reservationId: string, userId: string): void {
    this.props.linkedReservationId = reservationId;
    this.props.status = MissedCallStatus.HANDLED;
    this.props.handledByUserId = userId;
    this.touch();
  }
}
