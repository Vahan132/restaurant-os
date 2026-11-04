import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PUBLIC_STOREFRONT_QUERY } from './application/ports/public-query.port';
import { GetPublicMenuUseCase } from './application/queries/get-public-menu.usecase';
import { GetPublicRestaurantUseCase } from './application/queries/get-public-restaurant.usecase';
import { ListPublicBranchesUseCase } from './application/queries/list-public-branches.usecase';
import { ResolvePublicTableUseCase } from './application/queries/resolve-public-table.usecase';
import { PrismaPublicStorefrontQuery } from './infrastructure/prisma-public-storefront.query';
import { PublicStorefrontController } from './presentation/http/public-storefront.controller';
import { PublicRestaurantResolverGuard } from '../../shared/storefront/public-restaurant.resolver';

/**
 * Storefront module — PUBLIC, read-only QR menu. No domain/aggregate: the
 * infrastructure query uses PrismaService directly (read-side allowance). Routes
 * are rate-limited per IP (ThrottlerModule) and resolved by host/slug only.
 */
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [PublicStorefrontController],
  providers: [
    GetPublicRestaurantUseCase,
    GetPublicMenuUseCase,
    ResolvePublicTableUseCase,
    ListPublicBranchesUseCase,
    PublicRestaurantResolverGuard,
    { provide: PUBLIC_STOREFRONT_QUERY, useClass: PrismaPublicStorefrontQuery },
  ],
})
export class StorefrontModule {}
