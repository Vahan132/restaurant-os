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
import { InventoryModule } from './modules/inventory/inventory.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { EdgeRegistryModule } from './modules/edge-registry/edge-registry.module';
import { EdgeSyncModule } from './modules/edge-sync/edge-sync.module';
import { SecurityModule } from './shared/auth/security.module';
import { EdgeModule } from './shared/edge/edge.module';
import { AppConfigModule } from './shared/infrastructure/config/config.module';
import { EventsModule } from './shared/infrastructure/events/events.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';
import { RedisModule } from './shared/infrastructure/redis/redis.module';
import { TenancyModule } from './shared/tenancy/tenancy.module';

/**
 * Runtime mode is read straight from process.env at compose time (before the
 * config module validates) so the imports list can be built conditionally.
 * Defaults to CLOUD for any value other than the explicit "EDGE".
 */
const APP_MODE = process.env.APP_MODE === 'EDGE' ? 'EDGE' : 'CLOUD';
const IS_EDGE = APP_MODE === 'EDGE';

/**
 * Cloud-only modules that have no business on a single-branch hub and are
 * EXCLUDED in EDGE mode:
 *   - RedisModule       — EDGE uses the in-process Socket.IO adapter (no Redis).
 *   - PlatformModule    — cross-tenant super-admin (platform-admin, plans, orgs).
 *   - AccountModule     — self-serve org billing/subscription (depends on Platform).
 *   - EdgeRegistryModule— node provisioning + the cloud snapshot endpoint (OFF-2).
 * Nothing operational/catalog depends on their exports (verified), so the rest
 * of the app composes unchanged.
 */
const cloudOnlyModules = IS_EDGE
  ? []
  : [RedisModule, PlatformModule, AccountModule, EdgeRegistryModule];

/**
 * Edge-only modules, loaded ONLY on a hub:
 *   - EdgeSyncModule — pulls + applies the cloud snapshot on boot (OFF-2) and
 *     serves POST /edge/resync.
 */
const edgeOnlyModules = IS_EDGE ? [EdgeSyncModule] : [];

/**
 * Root module. Wires the shared kernel (global infra + tenancy + security + edge)
 * and mounts feature modules. New business modules follow
 * modules/MODULE_TEMPLATE.md.
 *
 * CLOUD (default) composes every module exactly as before. EDGE drops the
 * cloud-only modules above; all operational + catalog modules load normally.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    EventsModule,
    TenancyModule,
    SecurityModule,
    EdgeModule,
    HealthModule,
    IdentityModule,
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
    InventoryModule,
    CatalogModule,
    RealtimeModule,
    ...cloudOnlyModules,
    ...edgeOnlyModules,
  ],
})
export class AppModule {}
