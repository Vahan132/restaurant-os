import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TenancyModule } from '../tenancy/tenancy.module';
import { TenantGuard } from '../tenancy/tenant.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';

/**
 * SecurityModule — wires the global security pipeline.
 *
 * Guard order matters and is the registration order below:
 *   1. JwtAuthGuard   — verifies the access token, sets request.user
 *   2. TenantGuard    — derives request.tenant from request.user
 *   3. PermissionsGuard — enforces @RequirePermissions(...)
 *
 * Routes marked @Public() skip 1 and 2. JwtModule is registered here so the
 * auth guard can verify tokens (TokenService signs them in the identity module).
 */
@Global()
@Module({
  imports: [JwtModule.register({}), TenancyModule],
  providers: [
    JwtAuthGuard,
    PermissionsGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [JwtAuthGuard, PermissionsGuard],
})
export class SecurityModule {}
