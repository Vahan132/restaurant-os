import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdentityModule } from '../identity/identity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TablesModule } from '../tables/tables.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { FiscalizationModule } from '../fiscalization/fiscalization.module';
import { PaymentModule } from '../payment/payment.module';
import { ConsumerIdentityModule } from '../consumer-identity/consumer-identity.module';
import { PublicRestaurantResolverGuard } from '../../shared/storefront/public-restaurant.resolver';
import { SessionTokenGuard } from '../table-sessions/presentation/http/session-token.guard';
import { ConsumerAuthGuard } from '../consumer-identity/presentation/http/consumer-auth.guard';

import { ORDER_REPOSITORY } from './domain/repositories/order.repository';
import { MENU_READER } from './application/ports/menu-reader.port';
import { ORDER_SETTINGS_READER } from './application/ports/order-settings.reader';
import { ORDERS_TABLE_READER } from './application/ports/table-reader.port';
import { ORDERS_RESERVATION_READER } from './application/ports/reservation-conflict.reader';
import { USER_PERMISSION_READER } from './application/ports/user-permission.reader';
import { TABLE_STATUS_GATEWAY } from './application/ports/table-status.gateway';
import { RECEIPT_READER } from './application/ports/receipt-reader.port';

import { CreateOrderUseCase } from './application/commands/create-order.usecase';
import { AddOrderItemUseCase } from './application/commands/add-order-item.usecase';
import { EditOrderItemUseCase } from './application/commands/edit-order-item.usecase';
import { RemoveOrderItemUseCase } from './application/commands/remove-order-item.usecase';
import { SendToKitchenUseCase } from './application/commands/send-to-kitchen.usecase';
import { ApplyDiscountUseCase } from './application/commands/apply-discount.usecase';
import { RemoveDiscountUseCase } from './application/commands/remove-discount.usecase';
import { CancelOrderItemUseCase } from './application/commands/cancel-order-item.usecase';
import { CancelOrderUseCase } from './application/commands/cancel-order.usecase';
import { MoveOrderToTableUseCase } from './application/commands/move-order-to-table.usecase';
import { MarkOrderServedUseCase } from './application/commands/mark-order-served.usecase';
import { UpdateOrderNoteUseCase } from './application/commands/update-order-note.usecase';
import { ListOrdersUseCase } from './application/queries/list-orders.usecase';
import { GetOrderUseCase } from './application/queries/get-order.usecase';
import { RecordPaymentUseCase } from './application/commands/record-payment.usecase';
import { VoidPaymentUseCase } from './application/commands/void-payment.usecase';
import { CloseOrderUseCase } from './application/commands/close-order.usecase';
import { SplitEvenUseCase } from './application/commands/split-even.usecase';
import { SplitItemsToNewCheckUseCase } from './application/commands/split-items-to-new-check.usecase';
import { GetReceiptUseCase } from './application/queries/get-receipt.usecase';
import { ValidateCartUseCase } from './application/commands/validate-cart.usecase';
import { CreatePrepaymentOrderUseCase } from './application/commands/create-prepayment-order.usecase';
import { ConfirmPaymentUseCase } from './application/commands/confirm-payment.usecase';
import { GetOrderReceiptUseCase } from './application/queries/get-order-receipt.usecase';
import { AssertOrderOwnedByConsumerUseCase } from './application/queries/assert-order-owned-by-consumer.usecase';
import { CartPricingService } from './application/services/cart-pricing.service';
import { FiscalizeOrderService } from './application/services/fiscalize-order.service';
import { MarkOrderItemPreparingUseCase } from './application/commands/mark-order-item-preparing.usecase';
import { MarkOrderItemReadyUseCase } from './application/commands/mark-order-item-ready.usecase';
import { MarkOrderReadyUseCase } from './application/commands/mark-order-ready.usecase';
import { SubmitRequestedItemsUseCase } from './application/commands/submit-requested-items.usecase';
import { ApprovalChecker } from './application/services/approval-checker';
import { OrderItemBuilder } from './application/services/order-item-builder';
import { OrderTableSync } from './application/services/order-table-sync';

import { PrismaOrderRepository } from './infrastructure/persistence/prisma-order.repository';
import { PrismaMenuReader } from './infrastructure/readers/prisma-menu.reader';
import { PrismaOrderSettingsReader } from './infrastructure/readers/prisma-order-settings.reader';
import { PrismaOrdersTableReader } from './infrastructure/readers/prisma-table.reader';
import { PrismaOrdersReservationReader } from './infrastructure/readers/prisma-reservation-conflict.reader';
import { PrismaUserPermissionReader } from './infrastructure/readers/prisma-user-permission.reader';
import { PrismaReceiptReader } from './infrastructure/readers/prisma-receipt.reader';
import { TablesTableStatusGateway } from './infrastructure/gateways/tables-table-status.gateway';

import { OrdersController } from './presentation/http/orders.controller';
import { PublicQrOrdersController } from './presentation/http/public-qr-orders.controller';
import { AppOrdersController } from './presentation/http/app-orders.controller';
import { ConsumerThrottlerGuard } from './presentation/http/consumer-throttler.guard';

/**
 * Orders module (core; tenant-scoped). Imports IdentityModule (ID_GENERATOR) and
 * TablesModule (TableStatusService). ORDER-2 adds the QR-web prepayment surface:
 * imports TableSessionsModule (create-or-join + SessionTokenGuard), Fiscalization
 * + Payment modules (stubbed seams), and a per-module Throttler for the public
 * QR endpoints.
 */
@Module({
  imports: [
    IdentityModule,
    InventoryModule,
    TablesModule,
    TableSessionsModule,
    FiscalizationModule,
    PaymentModule,
    // ORDER-4: ConsumerIdentityModule exports CONSUMER_TOKEN_SERVICE so this
    // module can provide its own ConsumerAuthGuard instance for the app surface.
    ConsumerIdentityModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [OrdersController, PublicQrOrdersController, AppOrdersController],
  providers: [
    // application services
    OrderItemBuilder,
    OrderTableSync,
    ApprovalChecker,
    CartPricingService,
    FiscalizeOrderService,
    // ORDER-2 QR-web prepayment use-cases
    ValidateCartUseCase,
    CreatePrepaymentOrderUseCase,
    ConfirmPaymentUseCase,
    GetOrderReceiptUseCase,
    // ORDER-4: app-path ownership check (consumer owns the order).
    AssertOrderOwnedByConsumerUseCase,
    // guards for the public QR surface (host/slug resolution + session token).
    // SessionTokenGuard's deps (TABLE_SESSION_REPOSITORY, SESSION_TOKEN_SERVICE)
    // resolve via the TableSessionsModule import above.
    PublicRestaurantResolverGuard,
    SessionTokenGuard,
    // ORDER-4: app surface guards. ConsumerAuthGuard resolves CONSUMER_TOKEN_SERVICE
    // from the imported ConsumerIdentityModule; ConsumerThrottlerGuard keys the
    // rate limit by consumer.
    ConsumerAuthGuard,
    ConsumerThrottlerGuard,
    // use cases
    CreateOrderUseCase,
    AddOrderItemUseCase,
    EditOrderItemUseCase,
    RemoveOrderItemUseCase,
    SendToKitchenUseCase,
    ApplyDiscountUseCase,
    RemoveDiscountUseCase,
    CancelOrderItemUseCase,
    CancelOrderUseCase,
    MoveOrderToTableUseCase,
    MarkOrderServedUseCase,
    UpdateOrderNoteUseCase,
    ListOrdersUseCase,
    GetOrderUseCase,
    RecordPaymentUseCase,
    VoidPaymentUseCase,
    CloseOrderUseCase,
    SplitEvenUseCase,
    SplitItemsToNewCheckUseCase,
    GetReceiptUseCase,
    MarkOrderItemPreparingUseCase,
    MarkOrderItemReadyUseCase,
    MarkOrderReadyUseCase,
    SubmitRequestedItemsUseCase,

    // port -> implementation bindings
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    { provide: MENU_READER, useClass: PrismaMenuReader },
    { provide: ORDER_SETTINGS_READER, useClass: PrismaOrderSettingsReader },
    { provide: ORDERS_TABLE_READER, useClass: PrismaOrdersTableReader },
    { provide: ORDERS_RESERVATION_READER, useClass: PrismaOrdersReservationReader },
    { provide: USER_PERMISSION_READER, useClass: PrismaUserPermissionReader },
    { provide: TABLE_STATUS_GATEWAY, useClass: TablesTableStatusGateway },
    { provide: RECEIPT_READER, useClass: PrismaReceiptReader },
  ],
  exports: [
    // Exposed so the KDS module can delegate its actions to the orders aggregate.
    MarkOrderItemPreparingUseCase,
    MarkOrderItemReadyUseCase,
    MarkOrderReadyUseCase,
    // Exposed so the order-requests module can validate/snapshot + submit items.
    OrderItemBuilder,
    SubmitRequestedItemsUseCase,
  ],
})
export class OrdersModule {}
