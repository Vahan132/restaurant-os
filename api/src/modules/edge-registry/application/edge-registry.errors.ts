import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

/** Edge-registry application errors (standard error shape). */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const EdgeNodeNotFound = () =>
  new NotFoundException({ code: 'EDGE_NODE_NOT_FOUND', message: 'Edge node not found.' });

export const BranchNotInRestaurant = () =>
  new NotFoundException({
    code: 'BRANCH_NOT_FOUND',
    message: 'Branch not found in your restaurant.',
  });

/** Raised by EdgeAuthGuard for a missing/unknown/revoked node token. */
export const InvalidNodeToken = () =>
  new HttpException(
    { code: 'INVALID_NODE_TOKEN', message: 'The edge node token is missing, invalid, or revoked.' },
    HttpStatus.UNAUTHORIZED,
  );

/** Config-sync `since` cursor is not a valid ISO-8601 timestamp. */
export const InvalidCursor = () =>
  new BadRequestException({
    code: 'INVALID_CURSOR',
    message: 'The `since` cursor must be a valid ISO-8601 timestamp.',
  });

/** A pushed operational entry targets a branch other than the node's. */
export const CrossBranchEntry = () =>
  new BadRequestException({
    code: 'CROSS_BRANCH_ENTRY',
    message: 'A pushed entry does not belong to this node’s branch.',
  });

/** HTTP 426 Upgrade Required — the standard status for a version-gap refusal. */
const HTTP_UPGRADE_REQUIRED = 426;

/**
 * The hub's reported edge schema version does not match the cloud's expected
 * version (OFF-8). Sync endpoints reject with this so a stale hub cannot corrupt
 * the sync; the hub pauses sync, keeps serving locally, and surfaces "update
 * required". 426 Upgrade Required is the apt status.
 */
export const SchemaMismatch = (expected: string, got: string | null) =>
  new HttpException(
    {
      code: 'SCHEMA_MISMATCH',
      message: `Edge schema version ${got ?? '(none)'} is incompatible with the cloud (expected ${expected}). Update the hub.`,
      details: { expectedSchemaVersion: expected, reportedSchemaVersion: got },
    },
    HTTP_UPGRADE_REQUIRED,
  );
