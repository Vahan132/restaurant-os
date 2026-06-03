import { BadRequestException } from '@nestjs/common';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Application-level error helpers — standard error shape via AllExceptionsFilter.
 */
export const InvalidCredentials = () =>
  new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });

export const AccountBlocked = () =>
  new ForbiddenException({ code: 'ACCOUNT_BLOCKED', message: 'This account is blocked.' });

export const AccountSuspended = () =>
  new ForbiddenException({
    code: 'ACCOUNT_SUSPENDED',
    message: 'Your organization is suspended or its subscription is not active.',
  });

export const InvalidRefreshToken = () =>
  new UnauthorizedException({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid, expired, or has been revoked.',
  });

export const UserNotFound = () =>
  new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });

export const RoleNotFound = () =>
  new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found.' });

export const EmailAlreadyExists = () =>
  new ConflictException({
    code: 'EMAIL_ALREADY_EXISTS',
    message: 'A user with this email already exists in the organization.',
  });

export const RoleCodeAlreadyExists = () =>
  new ConflictException({
    code: 'ROLE_CODE_ALREADY_EXISTS',
    message: 'A role with this code already exists in the organization.',
  });

export const RoleInUse = () =>
  new ConflictException({
    code: 'ROLE_IN_USE',
    message: 'Role cannot be deleted while users are assigned to it.',
  });

export const RestaurantNotInOrg = () =>
  new NotFoundException({
    code: 'RESTAURANT_NOT_IN_ORG',
    message: 'Restaurant does not belong to this organization.',
  });

export const BranchNotInRestaurant = () =>
  new NotFoundException({
    code: 'BRANCH_NOT_IN_RESTAURANT',
    message: 'Branch does not belong to the specified restaurant.',
  });

export const CannotBlockSelf = () =>
  new ConflictException({
    code: 'CANNOT_BLOCK_SELF',
    message: 'You cannot block your own account.',
  });

export const InvalidResetToken = () =>
  new BadRequestException({
    code: 'INVALID_RESET_TOKEN',
    message: 'This password reset link is invalid or has expired.',
  });
