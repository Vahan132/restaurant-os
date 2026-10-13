import { BadRequestException } from '@nestjs/common';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
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

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const InvalidResetToken = () =>
  new BadRequestException({
    code: 'INVALID_RESET_TOKEN',
    message: 'This password reset link is invalid or has expired.',
  });

/** OFF-5: the edge denies a user with no access to the branch it serves. */
export const NoBranchAccessAtEdge = () =>
  new ForbiddenException({
    code: 'NO_BRANCH_ACCESS_AT_EDGE',
    message: 'You do not have access to the branch served by this hub.',
  });

/** OFF-5: no signing key available for the restaurant (e.g. edge not yet synced). */
export const SigningKeyUnavailable = () =>
  new ServiceUnavailableException({
    code: 'SIGNING_KEY_UNAVAILABLE',
    message: 'Token signing is temporarily unavailable for this restaurant.',
  });

// ── Device-anchored staff auth (3A) ─────────────────────────────────────────

/** No enrolled, active device matched the presented secret (PIN/anchored login).
 * Deliberately generic so it never reveals whether a device exists. */
export const InvalidDeviceSecret = () =>
  new UnauthorizedException({
    code: 'INVALID_DEVICE_SECRET',
    message: 'No active device matched the presented device secret.',
  });

export const DeviceNotFound = () =>
  new NotFoundException({ code: 'DEVICE_NOT_FOUND', message: 'Device not found.' });

/** The matched device cannot be used for the attempted surface (e.g. an ADMIN
 * device used for a POS/KDS PIN login, or vice versa). */
export const DeviceSurfaceNotAllowed = () =>
  new ForbiddenException({
    code: 'DEVICE_SURFACE_NOT_ALLOWED',
    message: 'This device is not allowed for the requested login surface.',
  });

/** Branch IP policy is STRICT and the request source IP is not in the allowlist. */
export const IpNotAllowed = () =>
  new ForbiddenException({
    code: 'IP_NOT_ALLOWED',
    message: 'This location is not permitted to sign in to this branch.',
  });

/** Generic PIN failure (wrong PIN or no PIN). Generic so it never reveals which. */
export const InvalidPin = () =>
  new UnauthorizedException({ code: 'INVALID_PIN', message: 'Invalid staff selection or PIN.' });

/** The user's PIN is temporarily locked after too many failed attempts. */
export const PinLocked = () =>
  new ForbiddenException({
    code: 'PIN_LOCKED',
    message: 'Too many failed attempts. This PIN is temporarily locked.',
  });

export const PinAlreadyExists = () =>
  new ConflictException({
    code: 'PIN_ALREADY_EXISTS',
    message: 'This user already has an active PIN. Reset it instead.',
  });

/** Could not mint a restaurant-unique PIN after several attempts (extremely rare). */
export const PinGenerationFailed = () =>
  new ServiceUnavailableException({
    code: 'PIN_GENERATION_FAILED',
    message: 'Could not allocate a unique PIN. Please try again.',
  });

export const StaffPinNotFound = () =>
  new NotFoundException({ code: 'STAFF_PIN_NOT_FOUND', message: 'This user has no PIN set.' });

/** Admin/manager email login requires an enrolled ADMIN-surface device and none
 * (valid) was presented; the restaurant has not enabled unanchored admin login. */
export const AdminDeviceRequired = () =>
  new ForbiddenException({
    code: 'ADMIN_DEVICE_REQUIRED',
    message: 'Sign-in from this account requires an enrolled admin device.',
  });
