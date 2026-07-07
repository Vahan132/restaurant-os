import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  OrderCreatedEvent,
  OrderClosedEvent,
  OrderItemCancelledEvent,
  OrderItemStatusChangedEvent,
  OrderItemsSentToKitchenEvent,
  OrderReadyEvent,
} from '../../orders/domain/events/order-events';
import { TableStatusChangedEvent } from '../../tables/domain/events/table-events';
import {
  OrderRequestConfirmedEvent,
  OrderRequestCreatedEvent,
  OrderRequestRejectedEvent,
} from '../../order-requests/domain/events/order-request-events';
import { RolePermissionsUpdatedEvent } from '../../identity/domain/events/role-events';
import { RealtimePublisher } from './realtime-publisher.service';

/**
 * Maps domain events -> small socket broadcasts. Payloads carry ids + new state
 * only; clients refetch details over HTTP. BR-5: every event is routed to its
 * aggregate's BRANCH room (e.branchId); station-targeted events go to that
 * branch's station room.
 */
@Injectable()
export class RealtimeRelay {
  constructor(private readonly pub: RealtimePublisher) {}

  @OnEvent('orders.order.items_sent_to_kitchen')
  onItemsSent(e: OrderItemsSentToKitchenEvent): void {
    const stations = new Set(e.items.map((i) => i.preparationStation));
    for (const station of stations) {
      this.pub.emitToStation(e.restaurantId, e.branchId, station, 'kds:ticket.new', {
        orderId: e.orderId,
        station,
      });
    }
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order.updated', { orderId: e.orderId });
  }

  @OnEvent('orders.order.item_cancelled')
  onItemCancelled(e: OrderItemCancelledEvent): void {
    this.pub.emitToStation(
      e.restaurantId,
      e.branchId,
      e.preparationStation,
      'kds:ticket.cancelled',
      {
        orderId: e.orderId,
        orderItemId: e.orderItemId,
      },
    );
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order.item.cancelled', {
      orderId: e.orderId,
      orderItemId: e.orderItemId,
    });
  }

  @OnEvent('orders.order.item_status_changed')
  onItemStatusChanged(e: OrderItemStatusChangedEvent): void {
    this.pub.emitToStation(e.restaurantId, e.branchId, e.preparationStation, 'kds:ticket.updated', {
      orderId: e.orderId,
      orderItemId: e.orderItemId,
      status: e.itemStatus,
    });
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order.updated', {
      orderId: e.orderId,
      status: e.orderStatus,
    });
  }

  @OnEvent('orders.order.ready')
  onOrderReady(e: OrderReadyEvent): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order.ready', {
      orderId: e.orderId,
      tableId: e.tableId,
    });
  }

  @OnEvent('orders.order.created')
  onOrderCreated(e: OrderCreatedEvent): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order.updated', {
      orderId: e.orderId,
      orderNumber: e.orderNumber,
    });
  }

  @OnEvent('orders.order.closed')
  onOrderClosed(e: OrderClosedEvent): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order.updated', {
      orderId: e.orderId,
      status: 'CLOSED',
    });
  }

  @OnEvent('reservations.reservation.created')
  @OnEvent('reservations.reservation.confirmed')
  @OnEvent('reservations.reservation.arrived')
  @OnEvent('reservations.reservation.seated')
  @OnEvent('reservations.reservation.completed')
  @OnEvent('reservations.reservation.cancelled')
  @OnEvent('reservations.reservation.no_show')
  onReservationChanged(e: {
    reservationId: string;
    restaurantId: string;
    branchId: string;
    status: string;
  }): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'reservation.updated', {
      reservationId: e.reservationId,
      status: e.status,
    });
  }

  @OnEvent('reservations.missed_call.created')
  onMissedCallCreated(e: {
    missedCallId: string;
    restaurantId: string;
    branchId: string;
    phoneNumber: string;
    callOccurredAt: Date;
  }): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'missedcall.new', {
      missedCallId: e.missedCallId,
      phoneNumber: e.phoneNumber,
      occurredAt:
        e.callOccurredAt instanceof Date ? e.callOccurredAt.toISOString() : e.callOccurredAt,
    });
  }

  @OnEvent('order_requests.request.created')
  onOrderRequestCreated(e: OrderRequestCreatedEvent): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order_request.new', {
      requestId: e.requestId,
      tableId: e.tableId,
      status: e.status,
    });
  }

  @OnEvent('order_requests.request.confirmed')
  onOrderRequestConfirmed(e: OrderRequestConfirmedEvent): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order_request.updated', {
      requestId: e.requestId,
      status: e.status,
      linkedOrderId: e.linkedOrderId,
    });
  }

  @OnEvent('order_requests.request.rejected')
  onOrderRequestRejected(e: OrderRequestRejectedEvent): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'order_request.updated', {
      requestId: e.requestId,
      status: e.status,
    });
  }

  @OnEvent('tables.table.status_changed')
  onTableStatusChanged(e: TableStatusChangedEvent): void {
    this.pub.emitToBranch(e.restaurantId, e.branchId, 'table.status_changed', {
      tableId: e.tableId,
      status: e.toStatus,
    });
  }

  /**
   * A role's permissions changed. Fan out to the org room so every open POS/KDS
   * session of a user holding that role refetches permissions (GET /auth/me) and
   * re-gates its UI live — no re-login. Cross-branch by design (a role spans
   * branches), so this uses the org room rather than a branch room.
   */
  @OnEvent('identity.role.permissions_updated')
  onRolePermissionsUpdated(e: RolePermissionsUpdatedEvent): void {
    this.pub.emitToOrg(e.organizationId, 'role.permissions.updated', { roleId: e.roleId });
  }
}
