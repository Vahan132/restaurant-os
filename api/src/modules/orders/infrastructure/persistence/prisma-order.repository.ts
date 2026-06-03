import { Injectable } from '@nestjs/common';
import { Order as PrismaOrderRow } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Order } from '../../domain/entities/order';
import { NON_TERMINAL_ORDER_STATUSES, TERMINAL_ORDER_STATUSES } from '../../domain/enums';
import { OrderListFilter, OrderRepository } from '../../domain/repositories/order.repository';
import { OrderMapper } from './order.mapper';

/** Minimal Prisma client surface (the real client or a transaction client). */
type Db = PrismaService;

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(order: Order): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Gapless per-restaurant number: atomic counter increment inside the tx.
      const counter = await tx.orderCounter.upsert({
        where: { restaurantId: order.restaurantId },
        create: { restaurantId: order.restaurantId, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      order.assignOrderNumber(counter.lastNumber);

      await tx.order.create({
        data: { id: order.id, orderNumber: order.orderNumber, ...OrderMapper.toOrderRow(order) },
      });
      await this.insertChildren(tx as unknown as Db, order);
      await this.insertPayments(tx as unknown as Db, order);
    });
  }

  async save(order: Order): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: OrderMapper.toOrderRow(order),
      });
      // Replace children (delete modifiers + items, then re-insert from aggregate).
      const existing = await tx.orderItem.findMany({ where: { orderId: order.id } });
      for (const it of existing) {
        await tx.orderItemModifier.deleteMany({ where: { orderItemId: it.id } });
      }
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      await this.insertChildren(tx as unknown as Db, order);
      // Replace payments (delete + re-insert from the aggregate).
      await tx.payment.deleteMany({ where: { orderId: order.id } });
      await this.insertPayments(tx as unknown as Db, order);
    });
  }

  private async insertChildren(tx: Db, order: Order): Promise<void> {
    for (const item of order.items) {
      await tx.orderItem.create({ data: OrderMapper.toItemRow(order, item) });
      for (const m of item.modifiers) {
        await tx.orderItemModifier.create({ data: OrderMapper.toModifierRow(item, m) });
      }
    }
  }

  private async insertPayments(tx: Db, order: Order): Promise<void> {
    for (const payment of order.payments) {
      await tx.payment.create({ data: OrderMapper.toPaymentRow(order, payment) });
    }
  }

  async findById(restaurantId: string, id: string): Promise<Order | null> {
    const order = await this.prisma.order.findFirst({ where: { id, restaurantId } });
    if (!order) {
      return null;
    }
    return this.hydrate(order);
  }

  async findByItemId(restaurantId: string, itemId: string): Promise<Order | null> {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, restaurantId },
    });
    if (!item) {
      return null;
    }
    return this.findById(restaurantId, item.orderId);
  }

  async list(filter: OrderListFilter): Promise<{ items: Order[]; total: number }> {
    const where: Record<string, unknown> = { restaurantId: filter.restaurantId };
    if (filter.status) where.status = filter.status;
    if (filter.tableId) where.tableId = filter.tableId;
    if (filter.waiterId) where.waiterId = filter.waiterId;
    if (filter.activeOnly) {
      where.status = { notIn: [...TERMINAL_ORDER_STATUSES] };
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { orderNumber: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
    const items = await Promise.all(rows.map((r) => this.hydrate(r)));
    return { items, total };
  }

  async findOpenByTable(restaurantId: string, tableId: string): Promise<Order | null> {
    const order = await this.prisma.order.findFirst({
      where: { restaurantId, tableId, status: { in: [...NON_TERMINAL_ORDER_STATUSES] } },
    });
    if (!order) {
      return null;
    }
    return this.hydrate(order);
  }

  async existsOtherOpenOnTable(
    restaurantId: string,
    tableId: string,
    excludeOrderId: string,
  ): Promise<boolean> {
    const count = await this.prisma.order.count({
      where: {
        restaurantId,
        tableId,
        id: { not: excludeOrderId },
        status: { in: [...NON_TERMINAL_ORDER_STATUSES] },
      },
    });
    return count > 0;
  }

  /** Load an order's items + modifiers + payments via separate scoped queries (no includes). */
  private async hydrate(order: PrismaOrderRow): Promise<Order> {
    const items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
    const withModifiers = await Promise.all(
      items.map(async (it) => ({
        ...it,
        modifiers: await this.prisma.orderItemModifier.findMany({
          where: { orderItemId: it.id },
        }),
      })),
    );
    const payments = await this.prisma.payment.findMany({ where: { orderId: order.id } });
    return OrderMapper.toDomain({ ...order, items: withModifiers, payments });
  }
}
