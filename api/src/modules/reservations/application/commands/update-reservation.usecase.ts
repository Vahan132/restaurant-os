import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Reservation } from '../../domain/entities/reservation';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import {
  NoRestaurantInScope,
  ReservationNotFound,
  ReservationsDisabled,
} from '../application.errors';
import {
  RESERVATION_SETTINGS_READER,
  ReservationSettingsReader,
} from '../ports/reservation-settings.reader';

export interface UpdateReservationInput {
  restaurantId: string | null;
  reservationId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string | null;
  guestCount?: number;
  reservedAt?: Date;
  durationMinutes?: number;
  notes?: string | null;
}

/** Edit reservation details (not when terminal). */
@Injectable()
export class UpdateReservationUseCase implements UseCase<UpdateReservationInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
    @Inject(RESERVATION_SETTINGS_READER) private readonly settings: ReservationSettingsReader,
  ) {}

  async execute(input: UpdateReservationInput): Promise<Reservation> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const settings = await this.settings.get(input.restaurantId);
    if (!settings.enableReservations) {
      throw ReservationsDisabled();
    }
    const reservation = await this.reservations.findById(input.restaurantId, input.reservationId);
    if (!reservation) {
      throw ReservationNotFound();
    }
    reservation.editDetails({
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      guestCount: input.guestCount,
      reservedAt: input.reservedAt,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
    });
    await this.reservations.save(reservation);
    return reservation;
  }
}
