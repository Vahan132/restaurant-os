import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { Reservation } from '../../domain/entities/reservation';
import { ReservationSource } from '../../domain/enums';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import {
  CrossBranchReference,
  NoRestaurantInScope,
  ReservationsDisabled,
  TableNotInRestaurant,
} from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';
import {
  RESERVATIONS_TABLE_READER,
  ReservationsTableReader,
} from '../ports/reservations-table.reader';

export interface CreateReservationInput {
  restaurantId: string | null;
  branchId: string;
  createdByUserId: string;
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
  /** CX-3: stamp the booking consumer (CustomerAccount id) when via the consumer app. */
  consumerId?: string | null;
  initialStatus?: 'PENDING' | 'CONFIRMED';
}

/** Create a reservation (plan). Optional table assignment does NOT hold the table. */
@Injectable()
export class CreateReservationUseCase implements UseCase<CreateReservationInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
    @Inject(RESERVATIONS_TABLE_READER) private readonly tables: ReservationsTableReader,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: CreateReservationInput): Promise<Reservation> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.enableReservations) {
      throw ReservationsDisabled();
    }
    if (input.tableId) {
      const table = await this.tables.findTableRef(input.restaurantId, input.tableId);
      if (table === null) {
        throw TableNotInRestaurant();
      }
      // §6 intra-branch integrity: the assigned table must be in this branch.
      if (table.branchId !== input.branchId) {
        throw CrossBranchReference();
      }
    }
    const reservation = Reservation.create({
      id: this.ids.generate(),
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      guestCount: input.guestCount,
      reservedAt: input.reservedAt,
      durationMinutes: input.durationMinutes,
      tableId: input.tableId ?? null,
      notes: input.notes ?? null,
      source: input.source ?? ReservationSource.STAFF,
      customerNote: input.customerNote ?? null,
      consumerId: input.consumerId ?? null,
      createdByUserId: input.createdByUserId,
    });
    if (input.initialStatus === 'CONFIRMED') {
      reservation.confirm();
    }
    await this.reservations.create(reservation);
    await this.events.publishFromAggregate(reservation);
    return reservation;
  }
}
