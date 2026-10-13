import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

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

/** BR-5 §6: a reservation's assigned table must belong to the reservation's branch. */
export const CrossBranchReference = () =>
  new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'The assigned table belongs to a different branch.',
  });

export const ReservationTableDisabled = () =>
  new ConflictException({
    code: 'TABLE_DISABLED',
    message: 'The assigned table is disabled and cannot be seated.',
  });

/**
 * The assigned table already has an active reservation whose time window overlaps
 * the requested one — prevents double-booking the same table for the same slot.
 */
export const TableAlreadyReserved = () =>
  new ConflictException({
    code: 'TABLE_ALREADY_RESERVED',
    message: 'The table is already reserved for an overlapping time window.',
  });

export const ReservationTimeInvalid = () =>
  new BadRequestException({
    code: 'RESERVATION_TIME_INVALID',
    message: 'reservedAt must be a valid date/time in the future.',
  });

export const ReservationRateLimited = () =>
  new HttpException(
    {
      code: 'RESERVATION_RATE_LIMITED',
      message: 'Too many reservation requests. Please try again later.',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );

export const NoDefaultBranch = () =>
  new ConflictException({
    code: 'NO_DEFAULT_BRANCH',
    message: 'This restaurant has no active default branch to receive the booking.',
  });

export const MissedCallNotFound = () =>
  new NotFoundException({ code: 'MISSED_CALL_NOT_FOUND', message: 'Missed call not found.' });

export const CallDeviceNotFound = () =>
  new NotFoundException({ code: 'CALL_DEVICE_NOT_FOUND', message: 'Call device not found.' });

export const InvalidDeviceToken = () =>
  new HttpException(
    { code: 'INVALID_DEVICE_TOKEN', message: 'The device token is missing, invalid, or revoked.' },
    HttpStatus.UNAUTHORIZED,
  );
