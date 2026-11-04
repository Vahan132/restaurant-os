import { randomUUID } from 'node:crypto';

/**
 * Object keys are ALWAYS namespaced by tenant (restaurant), so a presign — and
 * therefore the write access it grants — can never target another tenant's
 * prefix. The prefix is derived from the authenticated owner's restaurantId,
 * NEVER from client input, and the filename is a server-generated uuid.
 *
 * Layout:  restaurants/{restaurantId}/{segment}/{uuid}.{ext}
 */
export type MediaTarget = 'menu-item-image' | 'restaurant-photo' | 'logo';

const TARGET_SEGMENT: Record<MediaTarget, string> = {
  'menu-item-image': 'menu-items',
  'restaurant-photo': 'photos',
  logo: 'logo',
};

/** The tenant boundary every key for this restaurant must sit under. */
export function tenantPrefix(restaurantId: string): string {
  return `restaurants/${restaurantId}/`;
}

/** Build a fresh, tenant-scoped, server-owned key for a target + extension. */
export function buildObjectKey(restaurantId: string, target: MediaTarget, ext: string): string {
  return `${tenantPrefix(restaurantId)}${TARGET_SEGMENT[target]}/${randomUUID()}.${ext}`;
}

/** Finalize guard: does a stored key belong to this tenant's prefix? */
export function keyBelongsToTenant(key: string, restaurantId: string): boolean {
  return typeof key === 'string' && key.startsWith(tenantPrefix(restaurantId));
}
