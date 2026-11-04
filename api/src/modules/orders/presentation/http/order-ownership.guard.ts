import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';

/**
 * IIKO-PERM-1 — "Create and edit orders of other waiters" (iiko F_AOT).
 *
 * Runs AFTER the global auth / tenant / branch / permissions guards, so
 * `request.effectivePermissions` already holds the caller's permissions at the
 * active branch. A caller holding `order:edit_others` passes. Otherwise the
 * order addressed by `:id` must either have no waiter (QR / app orders) or be
 * the caller's own. A missing order is let through so the use case returns its
 * normal 404.
 */
@Injectable()
export class OrderOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const granted = request.effectivePermissions ?? [];
    if (granted.includes(PERMISSIONS.ORDER_EDIT_OTHERS)) return true;

    const rawId: unknown = request.params?.id;
    const orderId = typeof rawId === 'string' ? rawId : undefined;
    const restaurantId = request.tenant?.restaurantId;
    const userId = request.user?.sub;
    if (!orderId || !restaurantId || !userId) return true;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      select: { waiterId: true },
    });
    if (!order || !order.waiterId || order.waiterId === userId) return true;

    throw new ForbiddenException({
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'This order belongs to another waiter.',
      details: {
        required: [PERMISSIONS.ORDER_EDIT_OTHERS],
        missing: [PERMISSIONS.ORDER_EDIT_OTHERS],
      },
    });
  }
}

/** Mutating order route: the caller must own the order or hold `order:edit_others`. */
export const OwnOrderOrEditOthers = () => applyDecorators(UseGuards(OrderOwnershipGuard));
