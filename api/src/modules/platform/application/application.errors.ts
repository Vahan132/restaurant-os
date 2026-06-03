import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

/** Platform application-level error helpers (standard error shape). */

export const PlatformInvalidCredentials = () =>
  new UnauthorizedException({
    code: 'PLATFORM_INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
  });

export const PlatformAccountBlocked = () =>
  new ForbiddenException({ code: 'PLATFORM_ACCOUNT_BLOCKED', message: 'This account is blocked.' });

export const PlatformInvalidRefreshToken = () =>
  new UnauthorizedException({
    code: 'PLATFORM_INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid, expired, or has been revoked.',
  });

export const PlatformUserNotFound = () =>
  new NotFoundException({ code: 'PLATFORM_USER_NOT_FOUND', message: 'Platform user not found.' });

export const PlanNotFound = () =>
  new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found.' });

export const PlanCodeAlreadyExists = () =>
  new ConflictException({ code: 'PLAN_CODE_ALREADY_EXISTS', message: 'Plan code already exists.' });

export const OrganizationNotFound = () =>
  new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found.' });

export const OrganizationSlugAlreadyExists = () =>
  new ConflictException({
    code: 'ORGANIZATION_SLUG_ALREADY_EXISTS',
    message: 'Organization slug already exists.',
  });

export const SubscriptionNotFound = () =>
  new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found.' });
