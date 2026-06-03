import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MenuModule } from './modules/menu/menu.module';
import { KdsModule } from './modules/kds/kds.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PlatformModule } from './modules/platform/platform.module';
import { RestaurantModule } from './modules/restaurant/restaurant.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { AuditModule } from './modules/audit/audit.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { OrderRequestsModule } from './modules/order-requests/order-requests.module';
import { AccountModule } from './modules/account/account.module';
import { TablesModule } from './modules/tables/tables.module';
import { SecurityModule } from './shared/auth/security.module';
import { AppConfigModule } from './shared/infrastructure/config/config.module';
import { EventsModule } from './shared/infrastructure/events/events.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { TenancyModule } from './shared/tenancy/tenancy.module';

/**
 * Root module. Wires the shared kernel (global infra + tenancy + security) and
 * mounts feature modules. New business modules follow modules/MODULE_TEMPLATE.md.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    EventsModule,
    TenancyModule,
    SecurityModule,
    HealthModule,
    IdentityModule,
    PlatformModule,
    RestaurantModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    KdsModule,
    ReservationsModule,
    ReportsModule,
    AuditModule,
    StorefrontModule,
    OrderRequestsModule,
    AccountModule,
    RealtimeModule,
  ],
})
export class AppModule {}
