import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { IdentityModule } from '../../modules/identity/identity.module';
import { TenancyModule } from '../tenancy/tenancy.module';
import { TenantGuard } from '../tenancy/tenant.guard';
import { BranchAccessGuard } from './branch-access.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * SecurityModule — wires the global security pipeline.
 *
 * Guard order matters and is the registration order below:
 *   1. JwtAuthGuard      — verifies the access token, sets request.user
 *   2. TenantGuard       — derives request.tenant from request.user
 *   3. BranchAccessGuard — on @BranchScoped routes, validates X-Branch-Id and
 *                          resolves effective branch permissions
 *   4. PermissionsGuard  — enforces @RequirePermissions(...)
 *
 * Routes marked @Public() skip 1, 2 and 3. JwtModule is registered here so the
 * auth guard can verify tokens. IdentityModule is imported for the
 * BRANCH_ACCESS_RESOLVER consumed by BranchAccessGuard.
 */
@Global()
@Module({
  imports: [JwtModule.register({}), TenancyModule, IdentityModule],
  providers: [
    JwtAuthGuard,
    PermissionsGuard,
    BranchAccessGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: TenantGuard },
    { provide: APP_GUARD, useExisting: BranchAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [JwtAuthGuard, PermissionsGuard, BranchAccessGuard],
})
export class SecurityModule {}
