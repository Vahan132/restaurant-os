import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UserBlockedEvent,
  UserCreatedEvent,
  UserLoggedInEvent,
  UserUnblockedEvent,
} from '../../../identity/domain/events/user-events';
import {
  MenuItemCreatedEvent,
  MenuItemDeletedEvent,
  MenuItemPriceChangedEvent,
} from '../../../menu/domain/events/menu-events';
import {
  DiscountAppliedEvent,
  OrderCancelledEvent,
  OrderClosedEvent,
  OrderItemCancelledEvent,
  PaymentRecordedEvent,
} from '../../../orders/domain/events/order-events';
import {
  OrganizationProvisionedEvent,
  OrganizationSuspendedEvent,
  SubscriptionStatusChangedEvent,
} from '../../../platform/domain/events/platform-events';
import {
  ReservationCancelledEvent,
  ReservationNoShowEvent,
} from '../../../reservations/domain/events/reservation-events';
import { AppendAuditLogUseCase } from '../../application/commands/append-audit-log.usecase';
import { AuditActorType } from '../../domain/enums';

/**
 * Audit event subscribers. Map domain events emitted across all modules to
 * AuditLog rows. EVERY handler is fault-isolated (try/catch + swallow): a failed
 * audit write must NEVER break the originating business operation.
 */
@Injectable()
export class AuditEventSubscribers {
  private readonly logger = new Logger(AuditEventSubscribers.name);

  constructor(private readonly append: AppendAuditLogUseCase) {}

  /** Best-effort append: log and swallow any failure so the business op is unaffected. */
  private async safe(input: Parameters<AppendAuditLogUseCase['execute']>[0]): Promise<void> {
    try {
      await this.append.execute(input);
    } catch (err) {
      this.logger.warn(`Audit write failed for ${input.action}: ${(err as Error).message}`);
    }
  }

  // ── identity ──────────────────────────────────────────────────────────────
  @OnEvent('identity.user.logged_in')
  async onUserLoggedIn(e: UserLoggedInEvent): Promise<void> {
    await this.safe({
      organizationId: e.organizationId,
      actorType: AuditActorType.USER,
      actorId: e.userId,
      action: 'USER_LOGGED_IN',
      entityType: 'User',
      entityId: e.userId,
      ip: e.ip,
      userAgent: e.userAgent,
    });
  }

  @OnEvent('identity.user.created')
  async onUserCreated(e: UserCreatedEvent): Promise<void> {
    await this.safe({
      organizationId: e.organizationId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: e.userId,
      newValue: { email: e.email, roleId: e.roleId },
    });
  }

  @OnEvent('identity.user.blocked')
  async onUserBlocked(e: UserBlockedEvent): Promise<void> {
    await this.safe({
      organizationId: e.organizationId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'USER_BLOCKED',
      entityType: 'User',
      entityId: e.userId,
    });
  }

  @OnEvent('identity.user.unblocked')
  async onUserUnblocked(e: UserUnblockedEvent): Promise<void> {
    await this.safe({
      organizationId: e.organizationId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'USER_UNBLOCKED',
      entityType: 'User',
      entityId: e.userId,
    });
  }

  // ── menu ──────────────────────────────────────────────────────────────────
  @OnEvent('menu.item.created')
  async onMenuItemCreated(e: MenuItemCreatedEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'MENU_ITEM_CREATED',
      entityType: 'MenuItem',
      entityId: e.menuItemId,
      newValue: { categoryId: e.categoryId },
    });
  }

  @OnEvent('menu.item.price_changed')
  async onMenuItemPriceChanged(e: MenuItemPriceChangedEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'MENU_ITEM_PRICE_CHANGED',
      entityType: 'MenuItem',
      entityId: e.menuItemId,
      oldValue: { priceAmount: e.oldPriceAmount },
      newValue: { priceAmount: e.newPriceAmount },
    });
  }

  @OnEvent('menu.item.deleted')
  async onMenuItemDeleted(e: MenuItemDeletedEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'MENU_ITEM_DELETED',
      entityType: 'MenuItem',
      entityId: e.menuItemId,
    });
  }

  // ── orders ──────────────────────────────────────────────────────────────
  @OnEvent('orders.order.cancelled')
  async onOrderCancelled(e: OrderCancelledEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'ORDER_CANCELLED',
      entityType: 'Order',
      entityId: e.orderId,
      newValue: { reason: e.reason },
    });
  }

  @OnEvent('orders.order.item_cancelled')
  async onOrderItemCancelled(e: OrderItemCancelledEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'ORDER_ITEM_CANCELLED',
      entityType: 'OrderItem',
      entityId: e.orderItemId,
      newValue: { orderId: e.orderId, reason: e.reason },
    });
  }

  @OnEvent('orders.order.discount_applied')
  async onDiscountApplied(e: DiscountAppliedEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'DISCOUNT_APPLIED',
      entityType: 'Order',
      entityId: e.orderId,
      newValue: { discountAmount: e.discountAmount },
    });
  }

  @OnEvent('orders.payment.recorded')
  async onPaymentRecorded(e: PaymentRecordedEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'PAYMENT_RECORDED',
      entityType: 'Order',
      entityId: e.orderId,
      newValue: { paymentId: e.paymentId, amount: e.amount, paymentStatus: e.paymentStatus },
    });
  }

  @OnEvent('orders.order.closed')
  async onOrderClosed(e: OrderClosedEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'ORDER_CLOSED',
      entityType: 'Order',
      entityId: e.orderId,
    });
  }

  // ── reservations ──────────────────────────────────────────────────────────
  @OnEvent('reservations.reservation.cancelled')
  async onReservationCancelled(e: ReservationCancelledEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'RESERVATION_CANCELLED',
      entityType: 'Reservation',
      entityId: e.reservationId,
    });
  }

  @OnEvent('reservations.reservation.no_show')
  async onReservationNoShow(e: ReservationNoShowEvent): Promise<void> {
    await this.safe({
      restaurantId: e.restaurantId,
      actorType: e.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'RESERVATION_NO_SHOW',
      entityType: 'Reservation',
      entityId: e.reservationId,
    });
  }

  // ── platform (actorType PLATFORM_USER; org-scoped, restaurantId null) ──────
  @OnEvent('platform.organization.provisioned')
  async onOrganizationProvisioned(e: OrganizationProvisionedEvent): Promise<void> {
    await this.safe({
      organizationId: e.organizationId,
      actorType: e.actorUserId ? AuditActorType.PLATFORM_USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'ORGANIZATION_PROVISIONED',
      entityType: 'Organization',
      entityId: e.organizationId,
      newValue: { restaurantId: e.restaurantId, planCode: e.planCode },
    });
  }

  @OnEvent('platform.organization.suspended')
  async onOrganizationSuspended(e: OrganizationSuspendedEvent): Promise<void> {
    await this.safe({
      organizationId: e.organizationId,
      actorType: e.actorUserId ? AuditActorType.PLATFORM_USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'ORGANIZATION_SUSPENDED',
      entityType: 'Organization',
      entityId: e.organizationId,
    });
  }

  @OnEvent('platform.subscription.status_changed')
  async onSubscriptionStatusChanged(e: SubscriptionStatusChangedEvent): Promise<void> {
    await this.safe({
      organizationId: e.organizationId,
      actorType: e.actorUserId ? AuditActorType.PLATFORM_USER : AuditActorType.SYSTEM,
      actorId: e.actorUserId,
      action: 'SUBSCRIPTION_STATUS_CHANGED',
      entityType: 'Subscription',
      entityId: e.subscriptionId,
      newValue: { status: e.status },
    });
  }
}
