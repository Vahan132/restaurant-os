import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

/** Tables application-level errors (standard error shape). 404 hides cross-tenant rows. */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const FloorNotFound = () =>
  new NotFoundException({ code: 'FLOOR_NOT_FOUND', message: 'Floor not found.' });

export const TableNotFound = () =>
  new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Table not found.' });

export const ManualTableStatusDisabled = () =>
  new ConflictException({
    code: 'MANUAL_TABLE_STATUS_DISABLED',
    message:
      'Manual table status changes are disabled for this restaurant (flow-driven mode). Only cleaning->available and enabling/disabling are allowed.',
  });

export const CrossBranchReference = (message: string) =>
  new BadRequestException({ code: 'VALIDATION_ERROR', message });
