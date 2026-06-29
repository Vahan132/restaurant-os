import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { StepUpAuthorizationService } from '../../../identity/application/services/step-up-authorization.service';
import { Order } from '../../domain/entities/order';
import { DiscountType } from '../../domain/enums';
import {
  DiscountStepUpAuthorizedEvent,
  DiscountStepUpFailedEvent,
} from '../../domain/events/order-events';
import { ORDER_REPOSITORY, OrderRepository } from '../../domain/repositories/order.repository';
import {
  DiscountAuthorizationFailed,
  DiscountAuthorizationRequired,
  DiscountsDisabled,
  NoRestaurantInScope,
  OrderNotFound,
} from '../application.errors';
import { ORDER_SETTINGS_READER, OrderSettingsReader } from '../ports/order-settings.reader';
import { ApprovalChecker } from '../services/approval-checker';

/** Manager step-up authorization block (4A): device secret + manager PIN. */
export interface DiscountStepUpAuthorization {
  deviceSecret: string;
  pin: string;
}

export interface ApplyDiscountInput {
  restaurantId: string | null;
  branchId: string;
  organizationId: string;
  orderId: string;
  type: DiscountType;
  value: number;
  approvedByUserId?: string | null;
  actorUserId?: string | null;
  /**
   * Manager step-up authorization. Used ONLY when the caller does not hold
   * DISCOUNT_APPLY: a capable manager authorizes the discount by entering their
   * PIN on the enrolled POS device (the requesting user is never logged out).
   */
  authorization?: DiscountStepUpAuthorization | null;
  /** Real client IP (trust-proxy resolved) — for step-up IP policy + audit. */
  ip?: string | null;
}

/**
 * Apply a discount. Gated by allowDiscounts; honors requireApprovalForDiscount.
 *
 * Discount authority is the single permission DISCOUNT_APPLY (4A):
 *   - a caller HOLDING it applies directly (existing behavior);
 *   - a caller LACKING it must supply a step-up authorization block, which a
 *     capable manager satisfies with their PIN on the enrolled POS device. On
 *     success the manager is recorded as the approver and the requester as the
 *     actor; both are audited.
 */
@Injectable()
export class ApplyDiscountUseCase implements UseCase<ApplyDiscountInput, Order> {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ORDER_SETTINGS_READER) private readonly settings: OrderSettingsReader,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly access: BranchAccessResolver,
    private readonly approval: ApprovalChecker,
    private readonly stepUp: StepUpAuthorizationService,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ApplyDiscountInput): Promise<Order> {
    if (!input.restaurantId) {
      throw NoRestaurantInScope();
    }
    const restaurantId = input.restaurantId;
    const order = await this.orders.findById(restaurantId, input.branchId, input.orderId);
    if (!order) {
      throw OrderNotFound();
    }
    const settings = await this.settings.get(restaurantId);
    if (!settings.allowDiscounts) {
      throw DiscountsDisabled();
    }

    // Does the CALLER hold discount authority at THIS branch?
    const callerHoldsDiscount = await this.callerHoldsDiscountApply(
      input.organizationId,
      restaurantId,
      input.branchId,
      input.actorUserId ?? null,
    );

    if (callerHoldsDiscount) {
      // Direct path (unchanged): the caller is the approver when required.
      const approvedBy = await this.approval.resolve({
        organizationId: input.organizationId,
        required: settings.requireApprovalForDiscount,
        approvedByUserId: input.approvedByUserId,
        permission: PERMISSIONS.DISCOUNT_APPLY,
        action: 'discount',
      });
      order.applyDiscount(
        input.type,
        input.value,
        approvedBy,
        settings.serviceFeeRateBps,
        input.actorUserId ?? null,
      );
      await this.orders.save(order);
      await this.events.publishFromAggregate(order);
      return order;
    }

    // Step-up path: the caller lacks DISCOUNT_APPLY. A manager must authorize.
    if (!input.authorization) {
      throw DiscountAuthorizationRequired();
    }
    const result = await this.stepUp.authorize({
      organizationId: input.organizationId,
      restaurantId,
      branchId: input.branchId,
      deviceSecret: input.authorization.deviceSecret,
      pin: input.authorization.pin,
      ip: input.ip ?? null,
      requiredPermission: PERMISSIONS.DISCOUNT_APPLY,
    });

    if (!result.ok) {
      // Audit the failure with its specific factor (internal only), then return a
      // generic error that does not reveal which factor failed.
      await this.events.publish(
        new DiscountStepUpFailedEvent(
          order.id,
          restaurantId,
          input.branchId,
          input.actorUserId ?? null,
          result.deviceId,
          result.reason,
          input.ip ?? null,
        ),
      );
      throw DiscountAuthorizationFailed();
    }

    // Authorized: the manager is the approver; the requester stays the actor.
    order.applyDiscount(
      input.type,
      input.value,
      result.authorizerUserId,
      settings.serviceFeeRateBps,
      input.actorUserId ?? null,
    );
    await this.orders.save(order);
    // Existing DISCOUNT_APPLIED audit (via the aggregate event)...
    await this.events.publishFromAggregate(order);
    // ...plus the richer step-up authorization record (requester + manager + device + IP).
    await this.events.publish(
      new DiscountStepUpAuthorizedEvent(
        order.id,
        restaurantId,
        input.branchId,
        input.actorUserId ?? null,
        result.authorizerUserId,
        result.deviceId,
        input.type,
        input.value,
        order.discountAmount,
        input.ip ?? null,
      ),
    );
    return order;
  }

  private async callerHoldsDiscountApply(
    organizationId: string,
    restaurantId: string,
    branchId: string,
    userId: string | null,
  ): Promise<boolean> {
    if (!userId) {
      return false;
    }
    const access = await this.access.resolveForBranch({
      organizationId,
      restaurantId,
      userId,
      branchId,
    });
    return access.hasAccess && access.permissions.includes(PERMISSIONS.DISCOUNT_APPLY);
  }
}
