/**
 * Phase 02 — Restaurant (+ per-restaurant JWT signing key) + settings + the
 * platform super-admin. The signing key is generated through the app's REAL
 * provider (decision D): keyProvider.getSigningKey ensures-and-mints a 64-hex
 * key in CLOUD mode and persists it on the Restaurant row. It MUST exist before
 * staff PINs are minted (the PIN fingerprint is HMAC-keyed with it).
 */
import * as argon2 from 'argon2';
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { seedId } from '../ids';
import { ORG, RESTAURANT, PLATFORM_ADMIN } from '../data/core';

export async function seedRestaurant(ctx: SeedContext, _state: SeedState): Promise<void> {
  const { prisma, uc } = ctx;

  await prisma.restaurant.upsert({
    where: { id: RESTAURANT.id },
    update: {
      name: RESTAURANT.name,
      slug: RESTAURANT.slug,
      currency: RESTAURANT.currency,
      defaultLanguage: RESTAURANT.defaultLanguage,
      timezone: RESTAURANT.timezone,
      status: 'ACTIVE',
    },
    create: {
      id: RESTAURANT.id,
      organizationId: ORG.id,
      name: RESTAURANT.name,
      slug: RESTAURANT.slug,
      currency: RESTAURANT.currency,
      defaultLanguage: RESTAURANT.defaultLanguage,
      timezone: RESTAURANT.timezone,
      status: 'ACTIVE',
    },
  });

  await prisma.restaurantSettings.upsert({
    where: { restaurantId: RESTAURANT.id },
    update: {},
    create: {
      id: seedId('settings:tavern-ararat'),
      restaurantId: RESTAURANT.id,
      phone: '+374 10 000000',
      address: 'Հյուսիսային պողոտա, Երևան',
      enableReservations: true,
      enableKds: true,
      enableQrMenu: true,
    },
  });

  // Generate + persist the per-restaurant token signing key via the real util.
  const key = await uc.keyProvider.getSigningKey(RESTAURANT.id);
  if (!key) {
    throw new Error(
      'Restaurant signing key was not generated — is APP_MODE=CLOUD? (EDGE never mints keys.)',
    );
  }

  const adminHash = await argon2.hash(PLATFORM_ADMIN.password, { type: argon2.argon2id });
  await prisma.platformUser.upsert({
    where: { email: PLATFORM_ADMIN.email },
    update: {},
    create: {
      id: seedId('platform-user:admin'),
      email: PLATFORM_ADMIN.email,
      passwordHash: adminHash,
      fullName: PLATFORM_ADMIN.fullName,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
}
