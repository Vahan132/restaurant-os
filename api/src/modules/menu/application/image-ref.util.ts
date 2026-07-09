import { BadRequestException } from '@nestjs/common';
import { ObjectStoragePort } from '../../media/application/ports/object-storage.port';

/**
 * MEDIA-1 finalize helper. Reconciles the two ways an image can arrive on a menu
 * item — an uploaded object key (from a presign) or a pasted URL — into the pair
 * we persist: `imageUrl` (the resolved public URL, kept for non-breaking reads)
 * and `imageKey` (the durable, authoritative reference; null for URL-paste).
 *
 * The key must sit under the caller's tenant prefix (defence-in-depth: keys are
 * server-generated at presign, so a mismatch means a tampered/cross-tenant key).
 */
function assertTenantKey(key: string, restaurantId: string): void {
  if (!key.startsWith(`restaurants/${restaurantId}/`)) {
    throw new BadRequestException({
      code: 'OBJECT_KEY_OUTSIDE_TENANT',
      message: 'The object key does not belong to your restaurant.',
    });
  }
}

/** CREATE: always returns a concrete pair. */
export function resolveImageRef(
  storage: ObjectStoragePort,
  restaurantId: string,
  imageUrl?: string | null,
  imageKey?: string | null,
): { imageUrl: string | null; imageKey: string | null } {
  if (imageKey) {
    assertTenantKey(imageKey, restaurantId);
    return { imageUrl: storage.publicUrl(imageKey), imageKey };
  }
  return { imageUrl: imageUrl ?? null, imageKey: null };
}

/**
 * UPDATE (patch semantics): returns only the fields that should change.
 *   - a non-empty key  → adopt upload (imageUrl := publicUrl(key), imageKey := key)
 *   - an empty/null key → explicit clear of the upload (fall back to imageUrl paste)
 *   - key omitted, url present → URL-paste replaces any prior upload (imageKey := null)
 *   - both omitted → change nothing
 */
export function resolveImageRefPatch(
  storage: ObjectStoragePort,
  restaurantId: string,
  imageUrl: string | null | undefined,
  imageKey: string | null | undefined,
): { imageUrl?: string | null; imageKey?: string | null } {
  if (imageKey) {
    assertTenantKey(imageKey, restaurantId);
    return { imageUrl: storage.publicUrl(imageKey), imageKey };
  }
  if (imageKey === null || imageKey === '') {
    return { imageUrl: imageUrl ?? null, imageKey: null };
  }
  if (imageUrl !== undefined) {
    return { imageUrl, imageKey: null };
  }
  return {};
}
