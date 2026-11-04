import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ReservationSource, ReservationStatus, TERMINAL_RESERVATION_STATUSES } from '../enums';
import {
  ReservationArrivedEvent,
  ReservationCancelledEvent,
  ReservationCompletedEvent,
  ReservationConfirmedEvent,
  ReservationCreatedEvent,
  ReservationNoShowEvent,
  ReservationSeatedEvent,
} from '../events/reservation-events';
import { isValidReservationTransition } from '../reservation-status.policy';
import {
  InvalidGuestCountError,
  InvalidReservationTransitionError,
  ReservationNotMutableError,
  ReservedAtRequiredError,
} from '../reservations.errors';

/** Default reservation turn time (minutes) when the caller does not specify one. */
export const DEFAULT_RESERVATION_DURATION_MIN = 90;

export interface ReservationProps {
  restaurantId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  guestCount: number;
  reservedAt: Date;
  durationMinutes: number;
  tableId: string | null;
  status: ReservationStatus;
  source: ReservationSource;
  notes: string | null;
  customerNote: string | null;
  /** CX-3: the consumer (CustomerAccount) who booked, if via the consumer app. */
  consumerId: string | null;
  arrivedAt: Date | null;
  seatedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateReservationInput {
  id: string;
  restaurantId: string;
  branchId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  guestCount: number;
  reservedAt: Date;
  durationMinutes?: number;
  tableId?: string | null;
  notes?: string | null;
  source?: ReservationSource;
  customerNote?: string | null;
  /** CX-3: stamp the booking consumer (null for staff/public/phone bookings). */
  consumerId?: string | null;
  createdByUserId: string;
}

export interface EditReservationDetails {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  guestCount?: number;
  reservedAt?: Date;
  durationMinutes?: number;
  notes?: string | null;
}

/**
 * Reservation aggregate root. A reservation is a PLAN: assigning a table does NOT
 * place a live hold on it (no time-window blocking in the MVP). Status changes go
 * through the state machine; table-status side effects are handled in the
 * application layer (auto mode only).
 */
export class Reservation extends AggregateRoot<string> {
  private props: ReservationProps;

  private constructor(id: string, props: ReservationProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateReservationInput): Reservation {
    Reservation.assertGuestCount(input.guestCount);
    Reservation.assertReservedAt(input.reservedAt);
    const now = new Date();
    const reservation = new Reservation(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      guestCount: input.guestCount,
      reservedAt: input.reservedAt,
      durationMinutes: input.durationMinutes ?? DEFAULT_RESERVATION_DURATION_MIN,
      tableId: input.tableId ?? null,
      status: ReservationStatus.PENDING,
      source: input.source ?? ReservationSource.STAFF,
      notes: input.notes ?? null,
      customerNote: input.customerNote ?? null,
      consumerId: input.consumerId ?? null,
      arrivedAt: null,
      seatedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledReason: null,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    reservation.addDomainEvent(
      new ReservationCreatedEvent(
        reservation.id,
        input.restaurantId,
        reservation.props.branchId,
        reservation.props.status,
      ),
    );
    return reservation;
  }

  static reconstitute(id: string, props: ReservationProps): Reservation {
    return new Reservation(id, props);
  }

  private static assertGuestCount(count: number): void {
    if (!Number.isInteger(count) || count < 1) {
      throw new InvalidGuestCountError();
    }
  }
  private static assertReservedAt(reservedAt: Date): void {
    if (!(reservedAt instanceof Date) || Number.isNaN(reservedAt.getTime())) {
      throw new ReservedAtRequiredError();
    }
  }

  // ── getters ──────────────────────────────────────────────────────────────
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get customerName(): string {
    return this.props.customerName;
  }
  get customerPhone(): string {
    return this.props.customerPhone;
  }
  get customerEmail(): string | null {
    return this.props.customerEmail;
  }
  get guestCount(): number {
    return this.props.guestCount;
  }
  get reservedAt(): Date {
    return this.props.reservedAt;
  }
  get durationMinutes(): number {
    return this.props.durationMinutes;
  }
  get tableId(): string | null {
    return this.props.tableId;
  }
  get status(): ReservationStatus {
    return this.props.status;
  }
  get source(): ReservationSource {
    return this.props.source;
  }
  get notes(): string | null {
    return this.props.notes;
  }
  get customerNote(): string | null {
    return this.props.customerNote;
  }
  get consumerId(): string | null {
    return this.props.consumerId;
  }
  get arrivedAt(): Date | null {
    return this.props.arrivedAt;
  }
  get seatedAt(): Date | null {
    return this.props.seatedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }
  get cancelledReason(): string | null {
    return this.props.cancelledReason;
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
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  isTerminal(): boolean {
    return TERMINAL_RESERVATION_STATUSES.has(this.props.status);
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private assertNotTerminal(): void {
    if (this.isTerminal()) {
      throw new ReservationNotMutableError();
    }
  }

  private transitionTo(target: ReservationStatus): void {
    if (!isValidReservationTransition(this.props.status, target)) {
      throw new InvalidReservationTransitionError(this.props.status, target);
    }
    this.props.status = target;
  }

  // ── status transitions ─────────────────────────────────────────────────
  confirm(): void {
    this.transitionTo(ReservationStatus.CONFIRMED);
    this.touch();
    this.addDomainEvent(
      new ReservationConfirmedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.status,
      ),
    );
  }

  markArrived(now: Date = new Date()): void {
    this.transitionTo(ReservationStatus.ARRIVED);
    this.props.arrivedAt = now;
    this.touch();
    this.addDomainEvent(
      new ReservationArrivedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.status,
      ),
    );
  }

  markSeated(now: Date = new Date()): void {
    this.transitionTo(ReservationStatus.SEATED);
    this.props.seatedAt = now;
    this.touch();
    this.addDomainEvent(
      new ReservationSeatedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.status,
      ),
    );
  }

  complete(now: Date = new Date()): void {
    this.transitionTo(ReservationStatus.COMPLETED);
    this.props.completedAt = now;
    this.touch();
    this.addDomainEvent(
      new ReservationCompletedEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.status,
      ),
    );
  }

  cancel(reason: string | null, actorUserId: string | null = null, now: Date = new Date()): void {
    this.transitionTo(ReservationStatus.CANCELLED);
    this.props.cancelledAt = now;
    this.props.cancelledReason = reason ?? null;
    this.touch();
    this.addDomainEvent(
      new ReservationCancelledEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.status,
        actorUserId,
      ),
    );
  }

  markNoShow(actorUserId: string | null = null): void {
    this.transitionTo(ReservationStatus.NO_SHOW);
    this.touch();
    this.addDomainEvent(
      new ReservationNoShowEvent(
        this.id,
        this.props.restaurantId,
        this.props.branchId,
        this.props.status,
        actorUserId,
      ),
    );
  }

  // ── table plan + details (not when terminal) ─────────────────────────────
  assignTable(tableId: string): void {
    this.assertNotTerminal();
    this.props.tableId = tableId;
    this.touch();
  }

  clearTable(): void {
    this.assertNotTerminal();
    this.props.tableId = null;
    this.touch();
  }

  editDetails(details: EditReservationDetails): void {
    this.assertNotTerminal();
    if (details.guestCount !== undefined) {
      Reservation.assertGuestCount(details.guestCount);
      this.props.guestCount = details.guestCount;
    }
    if (details.reservedAt !== undefined) {
      Reservation.assertReservedAt(details.reservedAt);
      this.props.reservedAt = details.reservedAt;
    }
    if (details.customerName !== undefined) {
      this.props.customerName = details.customerName;
    }
    if (details.customerPhone !== undefined) {
      this.props.customerPhone = details.customerPhone;
    }
    if (details.customerEmail !== undefined) {
      this.props.customerEmail = details.customerEmail;
    }
    if (details.durationMinutes !== undefined) {
      this.props.durationMinutes = details.durationMinutes;
    }
    if (details.notes !== undefined) {
      this.props.notes = details.notes;
    }
    this.touch();
  }
}
