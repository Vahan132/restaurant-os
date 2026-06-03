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
import { RealtimePublisher } from './realtime-publisher.service';

/**
 * Maps domain events -> small socket broadcasts. Payloads carry ids + new state
 * only; clients refetch details over HTTP. Station-targeted events go to KDS
 * station rooms; order/table updates go to the restaurant room (POS/waiter).
 */
@Injectable()
export class RealtimeRelay {
  constructor(private readonly pub: RealtimePublisher) {}

  @OnEvent('orders.order.items_sent_to_kitchen')
  onItemsSent(e: OrderItemsSentToKitchenEvent): void {
    const stations = new Set(e.items.map((i) => i.preparationStation));
    for (const station of stations) {
      this.pub.emitToStation(e.restaurantId, station, 'kds:ticket.new', {
        orderId: e.orderId,
        station,
      });
    }
    this.pub.emitToRestaurant(e.restaurantId, 'order.updated', { orderId: e.orderId });
  }

  @OnEvent('orders.order.item_cancelled')
  onItemCancelled(e: OrderItemCancelledEvent): void {
    this.pub.emitToStation(e.restaurantId, e.preparationStation, 'kds:ticket.cancelled', {
      orderId: e.orderId,
      orderItemId: e.orderItemId,
    });
    this.pub.emitToRestaurant(e.restaurantId, 'order.item.cancelled', {
      orderId: e.orderId,
      orderItemId: e.orderItemId,
    });
  }

  @OnEvent('orders.order.item_status_changed')
  onItemStatusChanged(e: OrderItemStatusChangedEvent): void {
    this.pub.emitToStation(e.restaurantId, e.preparationStation, 'kds:ticket.updated', {
      orderId: e.orderId,
      orderItemId: e.orderItemId,
      status: e.itemStatus,
    });
    this.pub.emitToRestaurant(e.restaurantId, 'order.updated', {
      orderId: e.orderId,
      status: e.orderStatus,
    });
  }

  @OnEvent('orders.order.ready')
  onOrderReady(e: OrderReadyEvent): void {
    this.pub.emitToRestaurant(e.restaurantId, 'order.ready', {
      orderId: e.orderId,
      tableId: e.tableId,
    });
  }

  @OnEvent('orders.order.created')
  onOrderCreated(e: OrderCreatedEvent): void {
    this.pub.emitToRestaurant(e.restaurantId, 'order.updated', {
      orderId: e.orderId,
      orderNumber: e.orderNumber,
    });
  }

  @OnEvent('orders.order.closed')
  onOrderClosed(e: OrderClosedEvent): void {
    this.pub.emitToRestaurant(e.restaurantId, 'order.updated', {
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
  onReservationChanged(e: { reservationId: string; restaurantId: string; status: string }): void {
    this.pub.emitToRestaurant(e.restaurantId, 'reservation.updated', {
      reservationId: e.reservationId,
      status: e.status,
    });
  }

  @OnEvent('order_requests.request.created')
  onOrderRequestCreated(e: OrderRequestCreatedEvent): void {
    this.pub.emitToRestaurant(e.restaurantId, 'order_request.new', {
      requestId: e.requestId,
      tableId: e.tableId,
      status: e.status,
    });
  }

  @OnEvent('order_requests.request.confirmed')
  onOrderRequestConfirmed(e: OrderRequestConfirmedEvent): void {
    this.pub.emitToRestaurant(e.restaurantId, 'order_request.updated', {
      requestId: e.requestId,
      status: e.status,
      linkedOrderId: e.linkedOrderId,
    });
  }

  @OnEvent('order_requests.request.rejected')
  onOrderRequestRejected(e: OrderRequestRejectedEvent): void {
    this.pub.emitToRestaurant(e.restaurantId, 'order_request.updated', {
      requestId: e.requestId,
      status: e.status,
    });
  }

  @OnEvent('tables.table.status_changed')
  onTableStatusChanged(e: TableStatusChangedEvent): void {
    this.pub.emitToRestaurant(e.restaurantId, 'table.status_changed', {
      tableId: e.tableId,
      status: e.toStatus,
    });
  }
}
