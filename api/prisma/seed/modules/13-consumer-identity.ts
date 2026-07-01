/**
 * Phase 13 — CX-2 consumer identity + CX-3 booking/saved demo data.
 *
 * Seeds ONE demo CustomerAccount with a PHONE identity so CX-3 (booking/saved) and
 * CX-APP-2 (app auth wiring) have a consumer to attach to. Deterministic uuidv5 ids
 * (idempotent upserts). Do NOT seed real Google/Apple identities — those require
 * provider-verified subjects.
 *
 * CX-3: the demo consumer SAVES the listed flagship branch (real SaveRestaurant use
 * case — exercises the effective-listing gate), and gets two reservations stamped
 * with consumerId so "My Reservations" renders both upcoming + Past. Both go
 * through the REAL reservation creation path (CreateReservationUseCase) — NOT the
 * slot-validated consumer wrapper — so the seed stays deterministic regardless of
 * the current day's opening hours. The engine create permits a backdated reservedAt
 * (only the public request-to-book requires a future time), so the past row is
 * genuine. These reservation rows are cascade-cleared with the restaurant on reset.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCHES } from '../data/core';
import { seedId } from '../ids';
import { ReservationSource } from '../../../src/modules/reservations/domain/enums';

const DEMO_PHONE = '+37491234567';
const DEMO_NAME = 'Demo Customer';

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3600 * 1000);
}

export async function seedConsumerIdentity(ctx: SeedContext, _state: SeedState): Promise<void> {
  const { prisma, uc } = ctx;

  const accountId = seedId('consumer-account:demo');
  const identityId = seedId('consumer-identity:demo-phone');

  await prisma.customerAccount.upsert({
    where: { id: accountId },
    update: { name: DEMO_NAME, phone: DEMO_PHONE },
    create: { id: accountId, name: DEMO_NAME, phone: DEMO_PHONE },
  });

  await prisma.customerIdentity.upsert({
    where: { id: identityId },
    update: { subject: DEMO_PHONE, emailVerified: false },
    create: {
      id: identityId,
      customerAccountId: accountId,
      provider: 'PHONE',
      subject: DEMO_PHONE,
      emailVerified: false,
    },
  });

  // ── CX-3: saved restaurant (only the flagship is effectively listed) ──────────
  await uc.saveRestaurant.execute({ customerAccountId: accountId, branchId: BRANCHES.flagship.id });

  // ── CX-3: an upcoming + a past reservation, both stamped consumerId ───────────
  const common = {
    restaurantId: RESTAURANT.id,
    branchId: BRANCHES.flagship.id,
    createdByUserId: 'PUBLIC', // consumer-origin marker (no FK), mirrors the booking path
    customerName: DEMO_NAME,
    customerPhone: DEMO_PHONE,
    guestCount: 2,
    source: ReservationSource.PUBLIC,
    consumerId: accountId,
  };
  await uc.createReservation.execute({
    ...common,
    reservedAt: hoursFromNow(30),
    customerNote: 'Window seat if possible',
  });
  await uc.createReservation.execute({
    ...common,
    reservedAt: hoursFromNow(-72), // backdated → lands in "Past"
    customerNote: 'Birthday dinner',
  });
}
