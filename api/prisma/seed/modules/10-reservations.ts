/**
 * Phase 10 — Floors + tables (inert Prisma) and a bounded slice of reservations
 * across states (decision J), over a window around today. Tables are captured in
 * state for the orders phase (DINE_IN orders occupy a table).
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { RESTAURANT, BRANCHES } from '../data/core';
import type { BranchKey } from '../data/iam';
import { seedId } from '../ids';

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];

interface FloorSeed {
  slug: string;
  name: string;
  tables: Array<{ slug: string; name: string; seats: number }>;
}

const FLOORS: FloorSeed[] = [
  {
    slug: 'main-hall',
    name: 'Գլխավոր սրահ',
    tables: [
      { slug: 't1', name: 'Սեղան 1', seats: 4 },
      { slug: 't2', name: 'Սեղան 2', seats: 4 },
      { slug: 't3', name: 'Սեղան 3', seats: 6 },
      { slug: 't4', name: 'Սեղան 4', seats: 2 },
    ],
  },
  {
    slug: 'terrace',
    name: 'Բացօթյա պատշգամբ',
    tables: [
      { slug: 't5', name: 'Պատշգամբ 1', seats: 4 },
      { slug: 't6', name: 'Պատշգամբ 2', seats: 8 },
    ],
  },
];

function hoursFromNow(h: number): Date {
  return new Date(Date.now() + h * 3600 * 1000);
}

export async function seedReservations(ctx: SeedContext, state: SeedState): Promise<void> {
  const { prisma } = ctx;
  const rid = RESTAURANT.id;
  const createdByUserId = state.userIdBySlug['manager'];

  for (const bk of BRANCH_KEYS) {
    const branchId = BRANCHES[bk].id;
    state.tableIds[bk] = [];

    for (const floor of FLOORS) {
      const fid = seedId(`floor:${bk}:${floor.slug}`);
      await prisma.floor.upsert({
        where: { id: fid },
        update: { name: floor.name, status: 'ACTIVE' },
        create: { id: fid, restaurantId: rid, branchId, name: floor.name, status: 'ACTIVE' },
      });
      for (const t of floor.tables) {
        const tid = seedId(`table:${bk}:${t.slug}`);
        await prisma.restaurantTable.upsert({
          where: { id: tid },
          update: { name: t.name, seatCapacity: t.seats, floorId: fid },
          create: {
            id: tid,
            restaurantId: rid,
            branchId,
            floorId: fid,
            name: t.name,
            seatCapacity: t.seats,
            status: 'AVAILABLE',
          },
        });
        state.tableIds[bk].push(tid);
      }
    }

    // ── Reservations across states ────────────────────────────────────────────
    const tables = state.tableIds[bk];
    const reservations = [
      {
        slug: 'r1', status: 'PENDING', source: 'PUBLIC', reservedAt: hoursFromNow(28),
        customerName: 'Սուրեն Ավետիսյան', customerPhone: '+37491234501', guestCount: 2, tableId: null as string | null,
      },
      {
        slug: 'r2', status: 'CONFIRMED', source: 'STAFF', reservedAt: hoursFromNow(6),
        customerName: 'Մարիամ Հովհաննիսյան', customerPhone: '+37491234502', guestCount: 4, tableId: tables[0],
      },
      {
        slug: 'r3', status: 'SEATED', source: 'STAFF', reservedAt: hoursFromNow(-1),
        customerName: 'Տիգրան Խաչատրյան', customerPhone: '+37491234503', guestCount: 3, tableId: tables[2],
      },
      {
        slug: 'r4', status: 'CANCELLED', source: 'PHONE', reservedAt: hoursFromNow(10),
        customerName: 'Գայանե Սիմոնյան', customerPhone: '+37491234504', guestCount: 5, tableId: null,
      },
      {
        slug: 'r5', status: 'COMPLETED', source: 'STAFF', reservedAt: hoursFromNow(-26),
        customerName: 'Վահագն Մինասյան', customerPhone: '+37491234505', guestCount: 2, tableId: tables[3],
      },
    ];

    for (const r of reservations) {
      const id = seedId(`reservation:${bk}:${r.slug}`);
      const seatedAt = r.status === 'SEATED' ? hoursFromNow(-1) : null;
      const completedAt = r.status === 'COMPLETED' ? hoursFromNow(-24) : null;
      const cancelledAt = r.status === 'CANCELLED' ? hoursFromNow(-2) : null;
      await prisma.reservation.upsert({
        where: { id },
        update: { status: r.status as never },
        create: {
          id,
          restaurantId: rid,
          branchId,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          guestCount: r.guestCount,
          reservedAt: r.reservedAt,
          durationMinutes: 90,
          tableId: r.tableId,
          status: r.status as never,
          source: r.source as never,
          notes: 'SEED-1 reservation',
          seatedAt,
          completedAt,
          cancelledAt,
          cancelledReason: r.status === 'CANCELLED' ? 'Հաճախորդը չեղարկեց' : null,
          createdByUserId,
        },
      });
    }
  }
}
