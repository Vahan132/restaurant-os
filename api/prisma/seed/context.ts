/**
 * Nest application-context bootstrap for the seed (locked decision B).
 *
 * NestFactory.createApplicationContext(AppModule) boots the SAME container the
 * server uses — minus the HTTP/websocket transport — so the seed can resolve and
 * call the REAL use-cases (and therefore exercise the same domain invariants:
 * FIFO stock layers, ledger-maintained on-hand, BOM depletion on send-to-kitchen,
 * process input/output accrual). Inert config is written through the shared
 * PrismaService obtained from the same context.
 *
 * Boot prerequisites (CLOUD mode — the default; do NOT use EDGE for seeding, the
 * edge runtime never mints a per-restaurant signing key):
 *   - DATABASE_URL + JWT_ACCESS_SECRET + JWT_REFRESH_SECRET +
 *     PLATFORM_JWT_ACCESS_SECRET + PLATFORM_JWT_REFRESH_SECRET must be set
 *     (the config module validates these fail-fast).
 *   - Redis is imported in CLOUD mode. ioredis connects lazily-async with
 *     background retries; the seed issues no Redis commands, so an unreachable
 *     Redis does not block context boot. Run `pnpm docker:up` to start
 *     Postgres + Redis cleanly before seeding.
 */
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/infrastructure/prisma/prisma.service';

import { RESTAURANT_KEY_PROVIDER } from '../../src/modules/identity/application/ports/restaurant-key.provider';
import type { RestaurantKeyProvider } from '../../src/modules/identity/application/ports/restaurant-key.provider';
import { CreateStaffPinUseCase } from '../../src/modules/identity/application/commands/create-staff-pin.usecase';
import { EnrollDeviceUseCase } from '../../src/modules/identity/application/commands/enroll-device.usecase';

import { InventoryLocationProvisioner } from '../../src/modules/inventory/application/services/inventory-location-provisioner.service';
import { CreateGoodsReceiptUseCase } from '../../src/modules/inventory/application/commands/create-goods-receipt.usecase';
import { CreateProcessUseCase } from '../../src/modules/inventory/application/commands/create-process.usecase';
import { RunProcessUseCase } from '../../src/modules/inventory/application/commands/run-process.usecase';

import { UpdateRestaurantMarketingProfileUseCase } from '../../src/modules/consumer/application/commands/update-restaurant-marketing-profile.usecase';
import { SetRestaurantAttributesUseCase } from '../../src/modules/consumer/application/commands/set-restaurant-attributes.usecase';
import { AddRestaurantPhotoUseCase } from '../../src/modules/consumer/application/commands/add-restaurant-photo.usecase';
import { SetBranchPublicContactUseCase } from '../../src/modules/consumer/application/commands/set-branch-public-contact.usecase';
import { SetBranchPublicHoursUseCase } from '../../src/modules/consumer/application/commands/set-branch-public-hours.usecase';
import {
  SetBranchMenuPublicUseCase,
  SetBranchReservationsPublicUseCase,
} from '../../src/modules/consumer/application/commands/set-branch-visibility.usecase';
import { SetBranchListedUseCase } from '../../src/modules/consumer/application/commands/set-branch-listed.usecase';
import { SaveRestaurantUseCase } from '../../src/modules/consumer/application/commands/save-restaurant.usecase';
import { CreateReservationUseCase } from '../../src/modules/reservations/application/commands/create-reservation.usecase';

import { CreateOrderUseCase } from '../../src/modules/orders/application/commands/create-order.usecase';
import { AddOrderItemUseCase } from '../../src/modules/orders/application/commands/add-order-item.usecase';
import { SendToKitchenUseCase } from '../../src/modules/orders/application/commands/send-to-kitchen.usecase';
import { MarkOrderReadyUseCase } from '../../src/modules/orders/application/commands/mark-order-ready.usecase';
import { MarkOrderServedUseCase } from '../../src/modules/orders/application/commands/mark-order-served.usecase';
import { RecordPaymentUseCase } from '../../src/modules/orders/application/commands/record-payment.usecase';
import { CloseOrderUseCase } from '../../src/modules/orders/application/commands/close-order.usecase';
import { CancelOrderUseCase } from '../../src/modules/orders/application/commands/cancel-order.usecase';

export interface SeedUseCases {
  keyProvider: RestaurantKeyProvider;
  createStaffPin: CreateStaffPinUseCase;
  enrollDevice: EnrollDeviceUseCase;
  locations: InventoryLocationProvisioner;
  createGoodsReceipt: CreateGoodsReceiptUseCase;
  createProcess: CreateProcessUseCase;
  runProcess: RunProcessUseCase;
  createOrder: CreateOrderUseCase;
  addOrderItem: AddOrderItemUseCase;
  sendToKitchen: SendToKitchenUseCase;
  markOrderReady: MarkOrderReadyUseCase;
  markOrderServed: MarkOrderServedUseCase;
  recordPayment: RecordPaymentUseCase;
  closeOrder: CloseOrderUseCase;
  cancelOrder: CancelOrderUseCase;
  // CX-1 consumer discovery (write use-cases exercised by phase 12).
  updateMarketingProfile: UpdateRestaurantMarketingProfileUseCase;
  setRestaurantAttributes: SetRestaurantAttributesUseCase;
  addRestaurantPhoto: AddRestaurantPhotoUseCase;
  setBranchPublicContact: SetBranchPublicContactUseCase;
  setBranchPublicHours: SetBranchPublicHoursUseCase;
  setBranchMenuPublic: SetBranchMenuPublicUseCase;
  setBranchReservationsPublic: SetBranchReservationsPublicUseCase;
  setBranchListed: SetBranchListedUseCase;
  // CX-3 consumer booking + saved (phase 13).
  saveRestaurant: SaveRestaurantUseCase;
  createReservation: CreateReservationUseCase;
}

export interface SeedContext {
  app: INestApplicationContext;
  prisma: PrismaService;
  uc: SeedUseCases;
}

export async function bootstrapSeedContext(): Promise<SeedContext> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    // Keep the seed log readable; domain errors still surface.
    logger: ['error', 'warn'],
  });

  // PrismaService is a @Global exported provider (already $connect()-ed on init).
  const prisma = app.get(PrismaService);

  // Most use-cases are module-internal providers (not exported). `strict: false`
  // lets app.get resolve any provider anywhere in the container.
  const get = <T>(token: Parameters<typeof app.get>[0]): T =>
    app.get(token, { strict: false }) as T;

  const uc: SeedUseCases = {
    keyProvider: get<RestaurantKeyProvider>(RESTAURANT_KEY_PROVIDER),
    createStaffPin: get<CreateStaffPinUseCase>(CreateStaffPinUseCase),
    enrollDevice: get<EnrollDeviceUseCase>(EnrollDeviceUseCase),
    locations: get<InventoryLocationProvisioner>(InventoryLocationProvisioner),
    createGoodsReceipt: get<CreateGoodsReceiptUseCase>(CreateGoodsReceiptUseCase),
    createProcess: get<CreateProcessUseCase>(CreateProcessUseCase),
    runProcess: get<RunProcessUseCase>(RunProcessUseCase),
    createOrder: get<CreateOrderUseCase>(CreateOrderUseCase),
    addOrderItem: get<AddOrderItemUseCase>(AddOrderItemUseCase),
    sendToKitchen: get<SendToKitchenUseCase>(SendToKitchenUseCase),
    markOrderReady: get<MarkOrderReadyUseCase>(MarkOrderReadyUseCase),
    markOrderServed: get<MarkOrderServedUseCase>(MarkOrderServedUseCase),
    recordPayment: get<RecordPaymentUseCase>(RecordPaymentUseCase),
    closeOrder: get<CloseOrderUseCase>(CloseOrderUseCase),
    cancelOrder: get<CancelOrderUseCase>(CancelOrderUseCase),
    updateMarketingProfile: get<UpdateRestaurantMarketingProfileUseCase>(
      UpdateRestaurantMarketingProfileUseCase,
    ),
    setRestaurantAttributes: get<SetRestaurantAttributesUseCase>(SetRestaurantAttributesUseCase),
    addRestaurantPhoto: get<AddRestaurantPhotoUseCase>(AddRestaurantPhotoUseCase),
    setBranchPublicContact: get<SetBranchPublicContactUseCase>(SetBranchPublicContactUseCase),
    setBranchPublicHours: get<SetBranchPublicHoursUseCase>(SetBranchPublicHoursUseCase),
    setBranchMenuPublic: get<SetBranchMenuPublicUseCase>(SetBranchMenuPublicUseCase),
    setBranchReservationsPublic: get<SetBranchReservationsPublicUseCase>(
      SetBranchReservationsPublicUseCase,
    ),
    setBranchListed: get<SetBranchListedUseCase>(SetBranchListedUseCase),
    saveRestaurant: get<SaveRestaurantUseCase>(SaveRestaurantUseCase),
    createReservation: get<CreateReservationUseCase>(CreateReservationUseCase),
  };

  return { app, prisma, uc };
}
