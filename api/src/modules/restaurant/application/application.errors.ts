import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export const RestaurantNotFound = () =>
  new NotFoundException({
    code: 'RESTAURANT_NOT_FOUND',
    message: 'Restaurant not found in your organization.',
  });

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const RestaurantSettingsNotFound = () =>
  new NotFoundException({
    code: 'RESTAURANT_SETTINGS_NOT_FOUND',
    message: 'Restaurant settings not found.',
  });

export const BranchNotFound = () =>
  new NotFoundException({ code: 'BRANCH_NOT_FOUND', message: 'Branch not found.' });

export const BranchLimitExceeded = (max: number) =>
  new ConflictException({
    code: 'BRANCH_LIMIT_EXCEEDED',
    message: `Your plan allows at most ${max} active branch(es) per restaurant.`,
  });
