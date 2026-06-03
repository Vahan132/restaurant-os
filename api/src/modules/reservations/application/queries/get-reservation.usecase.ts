import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Reservation } from '../../domain/entities/reservation';
import {
  RESERVATION_REPOSITORY,
  ReservationRepository,
} from '../../domain/repositories/reservation.repository';
import { NoRestaurantInScope, ReservationNotFound } from '../application.errors';

export interface GetReservationInput {
  restaurantId: string | null;
  reservationId: string;
}

/** Fetch a single reservation (tenant-scoped; 404 hides cross-restaurant rows). */
@Injectable()
export class GetReservationUseCase implements UseCase<GetReservationInput, Reservation> {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservations: ReservationRepository,
  ) {}

  async execute(input: GetReservationInput): Promise<Reservation> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const reservation = await this.reservations.findById(input.restaurantId, input.reservationId);
    if (!reservation) {
      throw ReservationNotFound();
    }
    return reservation;
  }
}
