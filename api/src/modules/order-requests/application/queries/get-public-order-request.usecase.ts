import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { CustomerOrderRequest } from '../../domain/entities/customer-order-request';
import {
  ORDER_REQUEST_REPOSITORY,
  OrderRequestRepository,
} from '../../domain/repositories/order-request.repository';
import { NoRestaurantInScope, OrderRequestNotFound } from '../application.errors';

export interface GetPublicOrderRequestInput {
  restaurantId: string | null;
  id: string;
}

/** PUBLIC poll: status of one request. The id is the capability — scoped to the resolved restaurant. */
@Injectable()
export class GetPublicOrderRequestUseCase implements UseCase<
  GetPublicOrderRequestInput,
  CustomerOrderRequest
> {
  constructor(
    @Inject(ORDER_REQUEST_REPOSITORY) private readonly requests: OrderRequestRepository,
  ) {}

  async execute(input: GetPublicOrderRequestInput): Promise<CustomerOrderRequest> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const request = await this.requests.findById(input.restaurantId, input.id);
    if (!request) {
      throw OrderRequestNotFound();
    }
    return request;
  }
}
