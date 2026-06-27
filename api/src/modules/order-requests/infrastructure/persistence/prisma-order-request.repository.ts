import { Injectable } from '@nestjs/common';
import { CustomerOrderRequest as PrismaRequest } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CustomerOrderRequest } from '../../domain/entities/customer-order-request';
import {
  OrderRequestListFilter,
  OrderRequestRepository,
} from '../../domain/repositories/order-request.repository';
import { OrderRequestMapper } from './order-request.mapper';

@Injectable()
export class PrismaOrderRequestRepository implements OrderRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(request: CustomerOrderRequest): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.customerOrderRequest.create({
        data: { id: request.id, ...OrderRequestMapper.toRequestRow(request) },
      });
      for (const item of request.items) {
        await tx.customerOrderRequestItem.create({
          data: OrderRequestMapper.toItemRow(request.id, item),
        });
        for (const m of item.modifiers) {
          await tx.customerOrderRequestItemModifier.create({
            data: OrderRequestMapper.toModifierRow(item.id, m),
          });
        }
      }
    });
  }

  /** Only the request scalar (status/handling) changes after creation; items are immutable. */
  async save(request: CustomerOrderRequest): Promise<void> {
    await this.prisma.customerOrderRequest.update({
      where: { id: request.id },
      data: OrderRequestMapper.toRequestRow(request),
    });
  }

  async findById(restaurantId: string, id: string): Promise<CustomerOrderRequest | null> {
    const request = await this.prisma.customerOrderRequest.findFirst({
      where: { id, restaurantId },
    });
    if (!request) {
      return null;
    }
    return this.hydrate(request);
  }

  async list(
    filter: OrderRequestListFilter,
  ): Promise<{ items: CustomerOrderRequest[]; total: number }> {
    // A request's branch is its table's branch — scope via the table relation.
    const where: Record<string, unknown> = {
      restaurantId: filter.restaurantId,
      table: { branchId: filter.branchId },
    };
    if (filter.status) {
      where.status = filter.status;
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customerOrderRequest.findMany({
        where,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerOrderRequest.count({ where }),
    ]);
    const items = await Promise.all(rows.map((r) => this.hydrate(r)));
    return { items, total };
  }

  private async hydrate(request: PrismaRequest): Promise<CustomerOrderRequest> {
    const items = await this.prisma.customerOrderRequestItem.findMany({
      where: { requestId: request.id },
    });
    const withModifiers = await Promise.all(
      items.map(async (it) => ({
        ...it,
        modifiers: await this.prisma.customerOrderRequestItemModifier.findMany({
          where: { requestItemId: it.id },
        }),
      })),
    );
    return OrderRequestMapper.toDomain({ ...request, items: withModifiers });
  }
}
