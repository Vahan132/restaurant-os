import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() — marks a route (or controller) as not requiring authentication.
 * JwtAuthGuard and TenantGuard skip routes annotated with this decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
