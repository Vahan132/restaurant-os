import { BadRequestException, ForbiddenException } from '@nestjs/common';

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const InvalidDateRange = () =>
  new BadRequestException({
    code: 'INVALID_DATE_RANGE',
    message: '`from` must be on or before `to`.',
  });

export const BranchAccessForbidden = () =>
  new ForbiddenException({
    code: 'BRANCH_ACCESS_DENIED',
    message: 'You do not have access to this branch.',
  });
