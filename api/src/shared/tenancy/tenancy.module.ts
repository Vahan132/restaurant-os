import { Global, Module } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { TenantResolverService } from './tenant-resolver.service';

/**
 * Global tenancy module. Provides tenant resolution + the (stub) TenantGuard.
 * PrismaService and ConfigService come from their global modules.
 *
 * Decorators (@CurrentTenant, @CurrentUser) are plain functions and need no
 * provider registration.
 */
@Global()
@Module({
  providers: [TenantResolverService, TenantGuard],
  exports: [TenantResolverService, TenantGuard],
})
export class TenancyModule {}
