import { HttpException, HttpStatus } from '@nestjs/common';

/** EDGE-SETUP-3A hub-local setup/pairing errors (clear, page-actionable). */

/** The pairing code was rejected by the cloud (unknown/used/expired). */
export const SetupInvalidCode = () =>
  new HttpException(
    { code: 'INVALID_PAIRING_CODE', message: 'The pairing code is invalid, already used, or expired.' },
    HttpStatus.UNAUTHORIZED,
  );

/** The cloud could not be reached (network/DNS/TLS) — the hub stays in setup mode. */
export const SetupCloudUnreachable = () =>
  new HttpException(
    {
      code: 'CLOUD_UNREACHABLE',
      message: 'Could not reach the cloud to pair. Check the hub network and try again.',
    },
    HttpStatus.BAD_GATEWAY,
  );

/** No cloud server address was provided or baked in — the hub cannot pair yet. */
export const SetupCloudUrlMissing = () =>
  new HttpException(
    {
      code: 'CLOUD_URL_NOT_CONFIGURED',
      message: 'Enter the server address from your dashboard, then try again.',
    },
    HttpStatus.BAD_REQUEST,
  );

/** The cloud has no master KEK, so it cannot issue this hub's fiscal key. */
export const SetupKekUnavailable = () =>
  new HttpException(
    {
      code: 'PAIRING_KEK_UNAVAILABLE',
      message: 'The cloud could not issue a fiscal key right now. Contact support.',
    },
    HttpStatus.SERVICE_UNAVAILABLE,
  );

/** EDGE-PAIR-3: the cloud rate-limited this hub's pairing attempts (429). */
export const SetupRateLimited = () =>
  new HttpException(
    {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please wait a moment and try again.',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );

/** Any other pairing failure surfaced by the cloud. */
export const SetupPairingFailed = () =>
  new HttpException(
    { code: 'PAIRING_FAILED', message: 'Pairing failed. Please try again or contact support.' },
    HttpStatus.BAD_GATEWAY,
  );

/** /setup/* was hit on a process that is not an EDGE hub. */
export const SetupNotEdge = () =>
  new HttpException(
    { code: 'NOT_EDGE', message: 'Setup is only available on an edge hub.' },
    HttpStatus.NOT_FOUND,
  );
