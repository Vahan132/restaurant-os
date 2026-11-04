import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/** Catalog (BR-6) application-level errors (standard error shape). */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

/**
 * The :branchId path param does not match the active (X-Branch-Id) branch the
 * caller's access was resolved against. Prevents acting on a branch the guard
 * did not validate.
 */
export const BranchMismatch = () =>
  new BadRequestException({
    code: 'BRANCH_MISMATCH',
    message: 'The path branch id does not match the active branch.',
  });

export const SourceBranchNotFound = () =>
  new NotFoundException({
    code: 'SOURCE_BRANCH_NOT_FOUND',
    message: 'Source branch not found.',
  });

export const SourceBranchForbidden = () =>
  new ForbiddenException({
    code: 'SOURCE_BRANCH_FORBIDDEN',
    message: 'You do not have access to the source branch.',
  });

export const UnsupportedBundleVersion = (version: unknown) =>
  new BadRequestException({
    code: 'UNSUPPORTED_BUNDLE_VERSION',
    message: `Unsupported catalog bundle version: ${String(version)}.`,
  });
