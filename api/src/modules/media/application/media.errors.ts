import { BadRequestException } from '@nestjs/common';

/** Media/upload application-level errors (standard error shape). */

export const NoRestaurantInScope = () =>
  new BadRequestException({
    code: 'NO_RESTAURANT_IN_SCOPE',
    message: 'Your account is not scoped to a restaurant.',
  });

export const UnsupportedContentType = (contentType: string) =>
  new BadRequestException({
    code: 'UNSUPPORTED_CONTENT_TYPE',
    message: `Unsupported image content-type "${contentType}". Allowed: image/jpeg, image/png, image/webp.`,
  });

export const FileTooLarge = (maxBytes: number) =>
  new BadRequestException({
    code: 'FILE_TOO_LARGE',
    message: `Upload exceeds the maximum allowed size of ${maxBytes} bytes.`,
  });

/**
 * Defence-in-depth at finalize: a client-supplied key that does not sit under the
 * authenticated tenant's prefix. Keys are server-generated at presign, so this
 * should only fire on a tampered/cross-tenant key.
 */
export const ObjectKeyOutsideTenant = () =>
  new BadRequestException({
    code: 'OBJECT_KEY_OUTSIDE_TENANT',
    message: 'The object key does not belong to your restaurant.',
  });
