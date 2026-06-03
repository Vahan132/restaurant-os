import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from './tenant-context';

/**
 * @CurrentTenant() — injects the resolved TenantContext for the request.
 *
 * Throws a clear error if tenancy was not resolved (e.g. the route was not
 * placed behind TenantGuard / a resolver). From prompt 2, TenantGuard populates
 * `request.tenant` from the verified JWT.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const tenant = request.tenant;
    if (!tenant) {
      throw new InternalServerErrorException(
        'TenantContext is not available on the request. Ensure the route is protected by TenantGuard or a tenant resolver.',
      );
    }
    return tenant;
  },
);
