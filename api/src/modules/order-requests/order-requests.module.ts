import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdentityModule } from '../identity/identity.module';
import { OrdersModule } from '../orders/orders.module';
import { ORDER_REQUEST_REPOSITORY } from './domain/repositories/order-request.repository';
import { ORDER_REQUEST_SETTINGS_READER } from './application/ports/order-request-settings.reader';
import { ORDER_REQUEST_TABLE_READER } from './application/ports/order-request-table.reader';
import { CreateOrderRequestUseCase } from './application/commands/create-order-request.usecase';
import { ConfirmOrderRequestUseCase } from './application/commands/confirm-order-request.usecase';
import { RejectOrderRequestUseCase } from './application/commands/reject-order-request.usecase';
import { GetPublicOrderRequestUseCase } from './application/queries/get-public-order-request.usecase';
import { ListOrderRequestsUseCase } from './application/queries/list-order-requests.usecase';
import { PrismaOrderRequestRepository } from './infrastructure/persistence/prisma-order-request.repository';
import { PrismaOrderRequestSettingsReader } from './infrastructure/readers/prisma-order-request-settings.reader';
import { PrismaOrderRequestTableReader } from './infrastructure/readers/prisma-order-request-table.reader';
import { OrderRequestsController } from './presentation/http/order-requests.controller';
import { PublicOrderRequestsController } from './presentation/http/public-order-requests.controller';
import { PublicRestaurantResolverGuard } from '../../shared/storefront/public-restaurant.resolver';

/**
 * Order-requests module — customer dine-in ordering as staff-confirmed REQUESTS.
 * PUBLIC surface (host/slug-resolved, throttled) + STAFF surface (tenant-auth).
 * Confirmation reuses the orders module (SubmitRequestedItemsUseCase) to create/
 * merge + send the real order. ID_GENERATOR comes from IdentityModule.
 */
@Module({
  imports: [IdentityModule, OrdersModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
  controllers: [PublicOrderRequestsController, OrderRequestsController],
  providers: [
    CreateOrderRequestUseCase,
    GetPublicOrderRequestUseCase,
    ListOrderRequestsUseCase,
    ConfirmOrderRequestUseCase,
    RejectOrderRequestUseCase,
    PublicRestaurantResolverGuard,
    { provide: ORDER_REQUEST_REPOSITORY, useClass: PrismaOrderRequestRepository },
    { provide: ORDER_REQUEST_SETTINGS_READER, useClass: PrismaOrderRequestSettingsReader },
    { provide: ORDER_REQUEST_TABLE_READER, useClass: PrismaOrderRequestTableReader },
  ],
})
export class OrderRequestsModule {}
