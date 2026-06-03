import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { CustomerOrderRequest } from '../../domain/entities/customer-order-request';
import {
  ORDER_REQUEST_REPOSITORY,
  OrderRequestRepository,
} from '../../domain/repositories/order-request.repository';
import { NoRestaurantInScope, OrderRequestNotFound } from '../application.errors';

export interface RejectOrderRequestInput {
  restaurantId: string | null;
  requestId: string;
  userId: string;
  reason?: string | null;
}

/** STAFF: reject a PENDING request with a reason. */
@Injectable()
export class RejectOrderRequestUseCase implements UseCase<
  RejectOrderRequestInput,
  CustomerOrderRequest
> {
  constructor(
    @Inject(ORDER_REQUEST_REPOSITORY) private readonly requests: OrderRequestRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: RejectOrderRequestInput): Promise<CustomerOrderRequest> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const request = await this.requests.findById(input.restaurantId, input.requestId);
    if (!request) {
      throw OrderRequestNotFound();
    }
    request.reject(input.reason ?? null, input.userId);
    await this.requests.save(request);
    await this.events.publishFromAggregate(request);
    return request;
  }
}
