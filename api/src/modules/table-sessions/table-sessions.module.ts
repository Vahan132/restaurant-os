import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdentityModule } from '../identity/identity.module';
import { PublicRestaurantResolverGuard } from '../../shared/storefront/public-restaurant.resolver';

import { TABLE_SESSION_REPOSITORY } from './domain/repositories/table-session.repository';
import { ORDERING_POLICY_READER } from './application/ports/ordering-policy.reader';
import { TABLE_LOCATOR } from './application/ports/table-locator.reader';
import { SESSION_ORDER_STATUS_READER } from './application/ports/session-order-status.reader';
import { SESSION_TOKEN_SERVICE } from './application/ports/session-token.service';

import { OpenOrJoinTableSessionUseCase } from './application/commands/open-or-join-table-session.usecase';
import { ConfirmTableSessionUseCase } from './application/commands/confirm-table-session.usecase';
import { CloseTableSessionUseCase } from './application/commands/close-table-session.usecase';
import { ExpireIdleTableSessionsUseCase } from './application/commands/expire-idle-table-sessions.usecase';
import { TouchTableSessionUseCase } from './application/commands/touch-table-session.usecase';
import { GetTableSessionViewUseCase } from './application/queries/get-table-session-view.usecase';
import { IdleExpiryScheduler } from './application/schedule/idle-expiry.scheduler';

import { PrismaTableSessionRepository } from './infrastructure/persistence/prisma-table-session.repository';
import { PrismaOrderingPolicyReader } from './infrastructure/readers/prisma-ordering-policy.reader';
import { PrismaTableLocator } from './infrastructure/readers/prisma-table-locator.reader';
import { PrismaSessionOrderStatusReader } from './infrastructure/readers/prisma-session-order-status.reader';
import { CryptoSessionTokenService } from './infrastructure/services/crypto-session-token.service';

import { TableSessionsController } from './presentation/http/table-sessions.controller';
import { PublicTableSessionsController } from './presentation/http/public-table-sessions.controller';

/**
 * Table-sessions module (ORDER-1) — the ordering CONTAINER lifecycle.
 * PUBLIC surface (host/slug-resolved QR-web, throttled) + STAFF surface
 * (tenant-auth, branch-scoped). Imports IdentityModule to reuse ID_GENERATOR.
 * The idle sweep is driven by IdleExpiryScheduler (@Cron) — ScheduleModule is
 * registered once at the app root.
 */
@Module({
  imports: [IdentityModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }])],
  controllers: [PublicTableSessionsController, TableSessionsController],
  providers: [
    OpenOrJoinTableSessionUseCase,
    ConfirmTableSessionUseCase,
    CloseTableSessionUseCase,
    ExpireIdleTableSessionsUseCase,
    TouchTableSessionUseCase,
    GetTableSessionViewUseCase,
    IdleExpiryScheduler,
    PublicRestaurantResolverGuard,
    { provide: TABLE_SESSION_REPOSITORY, useClass: PrismaTableSessionRepository },
    { provide: ORDERING_POLICY_READER, useClass: PrismaOrderingPolicyReader },
    { provide: TABLE_LOCATOR, useClass: PrismaTableLocator },
    { provide: SESSION_ORDER_STATUS_READER, useClass: PrismaSessionOrderStatusReader },
    { provide: SESSION_TOKEN_SERVICE, useClass: CryptoSessionTokenService },
  ],
  // ORDER-2: expose the create-or-join + activity-touch use-cases, and the repo +
  // token-service tokens the SessionTokenGuard (provided in OrdersModule) needs.
  exports: [
    OpenOrJoinTableSessionUseCase,
    TouchTableSessionUseCase,
    TABLE_SESSION_REPOSITORY,
    SESSION_TOKEN_SERVICE,
    // ORDER-4: the app-ordering controller (OrdersModule) resolves the scanned
    // table via the same locator the QR-web open uses.
    TABLE_LOCATOR,
  ],
})
export class TableSessionsModule {}
