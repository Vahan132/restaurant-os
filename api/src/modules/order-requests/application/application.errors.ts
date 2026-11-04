import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'No restaurant resolved for this request.',
  });

export const CustomerOrderingDisabled = () =>
  new ForbiddenException({
    code: 'CUSTOMER_ORDERING_DISABLED',
    message: 'Customer ordering is not enabled for this restaurant.',
  });

export const TableNotFound = () =>
  new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Table not found.' });

export const OrderRequestNotFound = () =>
  new NotFoundException({ code: 'ORDER_REQUEST_NOT_FOUND', message: 'Order request not found.' });

/** BR-5 §6: a request can only be handled within its own (its table's) branch. */
export const CrossBranchReference = (message = 'This request belongs to a different branch.') =>
  new BadRequestException({ code: 'VALIDATION_ERROR', message });
