import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Reservations application-level errors (standard error shape). 404 hides cross-tenant rows. */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const ReservationsDisabled = () =>
  new ConflictException({
    code: 'RESERVATIONS_DISABLED',
    message: 'Reservations are disabled for this restaurant.',
  });

export const ReservationNotFound = () =>
  new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reservation not found.' });

export const TableNotInRestaurant = () =>
  new NotFoundException({
    code: 'TABLE_NOT_IN_RESTAURANT',
    message: 'Table not found in your restaurant.',
  });

export const ReservationTableDisabled = () =>
  new ConflictException({
    code: 'TABLE_DISABLED',
    message: 'The assigned table is disabled and cannot be seated.',
  });
