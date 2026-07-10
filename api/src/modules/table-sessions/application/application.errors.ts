import { BadRequestException, NotFoundException } from '@nestjs/common';

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'No restaurant resolved for this request.',
  });

export const TableNotFound = () =>
  new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Table not found.' });

export const BranchOrderingPolicyNotFound = () =>
  new NotFoundException({
    code: 'BRANCH_NOT_FOUND',
    message: 'Branch not found for this restaurant.',
  });

export const TableSessionNotFound = () =>
  new NotFoundException({ code: 'TABLE_SESSION_NOT_FOUND', message: 'Table session not found.' });

/** A session can only be handled within its own branch (the active branch). */
export const CrossBranchTableSession = (
  message = 'This table session belongs to a different branch.',
) => new BadRequestException({ code: 'VALIDATION_ERROR', message });
