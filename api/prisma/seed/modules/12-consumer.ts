/**
 * Phase 12 — CX-1 consumer discovery.
 *
 * 1) Taxonomy (inert config → deterministic upserts): categories + a starter set
 *    of values. The full curated value set is managed by platform-admin (CX-ADMIN).
 * 2) Make the flagship branch DISCOVERABLE through the REAL write use-cases (so the
 *    completeness gate + url/hours invariants are exercised — not raw Prisma):
 *    marketing profile → photos → attribute selection → branch contact + weekly
 *    hours (incl. a cross-midnight day) → menu/reservations public → SetBranchListed
 *    (must pass the gate). `consumerListingSuppressed` stays false (schema default).
 *
 * The brand logo lives on RestaurantSettings (no write use-case for it); the gate
 * reads it from there, so we set a stable placeholder logoUrl here (inert config).
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCHES } from '../data/core';
import {
  ATTRIBUTE_TAXONOMY,
  FLAGSHIP_ATTRIBUTE_SELECTION,
  FLAGSHIP_CONTACT,
  FLAGSHIP_HOURS,
  FLAGSHIP_MARKETING,
  FLAGSHIP_PHOTOS,
  attributeValueId,
} from '../data/consumer';

export async function seedConsumer(ctx: SeedContext, _state: SeedState): Promise<void> {
  const { prisma, uc } = ctx;
  const restaurantId = RESTAURANT.id;
  const branchId = BRANCHES.flagship.id;

  // ── 1) Taxonomy (deterministic upserts) ─────────────────────────────────────
  for (const cat of ATTRIBUTE_TAXONOMY) {
    await prisma.attributeCategory.upsert({
      where: { id: cat.id },
      update: {
        slug: cat.slug,
        labelHy: cat.labelHy,
        labelRu: cat.labelRu,
        labelEn: cat.labelEn,
        position: cat.position,
        isFilterable: cat.isFilterable,
      },
      create: {
        id: cat.id,
        slug: cat.slug,
        labelHy: cat.labelHy,
        labelRu: cat.labelRu,
        labelEn: cat.labelEn,
        position: cat.position,
        isFilterable: cat.isFilterable,
      },
    });
    for (const val of cat.values) {
      await prisma.attributeValue.upsert({
        where: { id: val.id },
        update: {
          categoryId: cat.id,
          slug: val.slug,
          labelHy: val.labelHy,
          labelRu: val.labelRu,
          labelEn: val.labelEn,
          position: val.position,
        },
        create: {
          id: val.id,
          categoryId: cat.id,
          slug: val.slug,
          labelHy: val.labelHy,
          labelRu: val.labelRu,
          labelEn: val.labelEn,
          position: val.position,
        },
      });
    }
  }

  // ── 2a) Brand logo (inert config; gate reads RestaurantSettings.logoUrl) ─────
  await prisma.restaurantSettings.update({
    where: { restaurantId },
    data: { logoUrl: FLAGSHIP_MARKETING.logoUrl },
  });

  // ── 2b) Marketing profile (real use-case) ────────────────────────────────────
  await uc.updateMarketingProfile.execute({
    restaurantId,
    about: { hy: FLAGSHIP_MARKETING.aboutHy, ru: FLAGSHIP_MARKETING.aboutRu, en: FLAGSHIP_MARKETING.aboutEn },
    website: FLAGSHIP_MARKETING.website,
  });

  // ── 2c) Photos (real use-case; https url invariant) ──────────────────────────
  for (const photo of FLAGSHIP_PHOTOS) {
    await uc.addRestaurantPhoto.execute({
      restaurantId,
      url: photo.url,
      alt: { hy: photo.altHy, ru: photo.altRu, en: photo.altEn },
    });
  }

  // ── 2d) Attribute selection (real use-case; validates each value exists) ─────
  await uc.setRestaurantAttributes.execute({
    restaurantId,
    attributeValueIds: FLAGSHIP_ATTRIBUTE_SELECTION.map(([c, v]) => attributeValueId(c, v)),
  });

  // ── 2e) Branch public contact + weekly hours (real use-cases) ────────────────
  await uc.setBranchPublicContact.execute({
    branchId,
    publicPhone: FLAGSHIP_CONTACT.publicPhone,
    address: FLAGSHIP_CONTACT.address,
    city: FLAGSHIP_CONTACT.city,
  });
  await uc.setBranchPublicHours.execute({
    branchId,
    rows: FLAGSHIP_HOURS.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      isClosed: h.isClosed,
      opensAt: h.opensAt ?? null,
      closesAt: h.closesAt ?? null,
    })),
  });

  // ── 2f) Visibility flags, then list (must pass the completeness gate) ────────
  await uc.setBranchMenuPublic.execute({ branchId, value: true });
  await uc.setBranchReservationsPublic.execute({ branchId, value: true });
  await uc.setBranchListed.execute({ branchId, value: true });
}
