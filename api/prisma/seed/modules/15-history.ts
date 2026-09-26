/**
 * Phase 15 (SEED-2) — multi-day operating history so EVERY report has data.
 *
 * For each business day in the history window (history-clock.ts, default 45 days
 * before today, oldest first) and each branch it drives the REAL use-cases:
 *
 *   - restock goods receipts (top-up of items below 60% of par, cost drifts a
 *     few % so FIFO cost-price history moves)        → RECEIPT_IN + layers
 *   - production runs on the flagship (pork marinade daily, tomato sauce
 *     every other day)                               → PROCESS_OUT / PROCESS_IN
 *   - 8–25 orders/day (busier Fri/Sat) spread 11:00–23:30, dine-in on random
 *     tables + takeaway, random modifiers, several waiters, mixed payment methods
 *     (cash / card / bank transfer / split), discounts (percent + fixed),
 *     cancelled lines and cancelled orders          → CONSUMPTION_OUT + reversals
 *   - write-offs (spoilage, staff meal, breakage, dish waste) → WRITE_OFF_OUT
 *   - expenses in managed categories (Prisma: the expenses module has no domain
 *     invariants beyond the row itself)
 *
 * The order/payment use-cases stamp "now", so each order is BACKDATED right after
 * it finishes: orders, order items, payments and the ORDER_LINE stock movements
 * (+ reversals) are moved onto the business day, so revenue (closedAt), the
 * cancellation / discount reports (createdAt) and the daily inventory report
 * (movement occurredAt) all bucket onto the intended day. Receipts, runs and
 * write-offs take their date natively (receivedAt / runAt / occurredAt).
 *
 * Also seeds one imported-sales batch covering the two weeks BEFORE the window
 * (legacy POS history), for the "Imported sales" report.
 *
 * Deterministic: a fixed-seed PRNG, so every run produces the same history
 * (relative to today's date).
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { ORG, RESTAURANT, BRANCHES } from '../data/core';
import type { BranchKey } from '../data/iam';
import { DISHES, MODIFIER_GROUPS } from '../data/menu';
import type { DishSeed } from '../data/menu';
import { ITEMS } from '../data/inventory';
import type { LocationKey } from '../data/inventory';
import { seedId } from '../ids';
import { historyDays, localTime, makeRng, daysAgo, HISTORY_DAYS } from '../history-clock';
import type { LocalDay } from '../history-clock';
import { OrderType, PaymentMethod, DiscountType } from '../../../src/modules/orders/domain/enums';
import { WriteOffLineKind, WriteOffReason } from '../../../src/modules/inventory/domain/enums';

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];
const LOCATIONS: LocationKey[] = ['KITCHEN', 'BAR', 'MAIN_STORAGE'];
const ORDER_LINE = 'ORDER_LINE';
const MIN = 60_000;

/** Waiters credited on orders (drives the "Waiters" report). */
const WAITERS: Record<BranchKey, string[]> = {
  flagship: ['waiter-flagship', 'waiter-flagship', 'manager', 'cashier-flagship'],
  second: ['waiter-gyumri', 'waiter-gyumri', 'cashier-gyumri'],
};
const CASHIER: Record<BranchKey, string> = {
  flagship: 'cashier-flagship',
  second: 'cashier-gyumri',
};
/** Base orders per day (Mon–Thu); Fri/Sat ×1.5, Sun ×1.2. */
const BASE_ORDERS: Record<BranchKey, number> = { flagship: 13, second: 8 };

const SUPPLIERS: Record<LocationKey, { slug: string; name: string; contact: string }> = {
  KITCHEN: { slug: 'fresh-market', name: 'Թարմ Շուկա ՍՊԸ', contact: '+374 10 55 11 22' },
  BAR: { slug: 'ararat-drinks', name: 'Արարատ Դրինքս ՓԲԸ', contact: '+374 10 44 33 22' },
  MAIN_STORAGE: { slug: 'dry-goods', name: 'Չոր Մթերք Հոլսեյլ', contact: '+374 10 22 66 77' },
};

const EXPENSE_CATEGORIES = [
  { slug: 'utilities', name: 'Կոմունալ ծախսեր' },
  { slug: 'supplies', name: 'Տնտեսական ապրանքներ' },
  { slug: 'repairs', name: 'Վերանորոգում և սպասարկում' },
  { slug: 'marketing', name: 'Մարքեթինգ' },
  { slug: 'transport', name: 'Տրանսպորտ' },
] as const;

const CANCEL_REASONS = [
  'Հաճախորդը փոխեց պատվերը',
  'Սխալ մուտքագրում',
  'Ուտեստը վերջացել է',
  'Երկար սպասում',
];

type Rng = () => number;
const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

// Sellable dishes (the verify-* dishes are QA fixtures, not menu items).
const SELLABLE = DISHES.filter((d) => !d.slug.startsWith('verify-'));
// Popularity weights: grill + drinks sell most.
const WEIGHT: Record<string, number> = { grill: 5, drinks: 6, salads: 3, soups: 2, mains: 3, desserts: 2 };
const WEIGHTED: DishSeed[] = SELLABLE.flatMap((d) => Array(WEIGHT[d.category] ?? 1).fill(d));

export async function seedHistory(ctx: SeedContext, state: SeedState): Promise<void> {
  if (HISTORY_DAYS === 0) {
    return;
  }
  const { prisma } = ctx;
  const rid = RESTAURANT.id;
  const ownerId = state.userIdBySlug['owner'];
  const rng = makeRng(20260925);
  const days = historyDays();

  // ── Inert config: suppliers + expense categories per branch ────────────────
  const supplierIds: Record<BranchKey, Record<LocationKey, string>> = { flagship: {}, second: {} } as never;
  const expenseCatIds: Record<BranchKey, Record<string, string>> = { flagship: {}, second: {} };
  for (const bk of BRANCH_KEYS) {
    const branchId = BRANCHES[bk].id;
    for (const loc of LOCATIONS) {
      const s = SUPPLIERS[loc];
      const id = seedId(`supplier:${bk}:${s.slug}`);
      await prisma.supplier.upsert({
        where: { id },
        update: { name: s.name, contact: s.contact, deletedAt: null },
        create: { id, restaurantId: rid, branchId, name: s.name, contact: s.contact },
      });
      supplierIds[bk][loc] = id;
    }
    for (const c of EXPENSE_CATEGORIES) {
      const id = seedId(`expense-category:${bk}:${c.slug}`);
      await prisma.expenseCategory.upsert({
        where: { id },
        update: { name: c.name, deletedAt: null },
        create: { id, restaurantId: rid, branchId, name: c.name },
      });
      expenseCatIds[bk][c.slug] = id;
    }
  }

  let orderCount = 0;
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const sweepFrom = new Date();
    for (const bk of BRANCH_KEYS) {
      await restock(ctx, state, bk, day, di, supplierIds[bk]);
      if (bk === 'flagship') {
        await productionRuns(ctx, state, day, di);
      }
      orderCount += await ordersForDay(ctx, state, bk, day, rng);
      await writeOffs(ctx, state, bk, day, di, rng);
      await expenses(ctx, state, bk, day, di, rng, expenseCatIds[bk]);
    }
    // Cost-price history rows written while replaying this day → onto this day.
    const eod = localTime(day, 23, 45);
    await prisma.inventoryItemCostChange.updateMany({
      where: { restaurantId: rid, createdAt: { gte: sweepFrom } },
      data: { occurredAt: eod, createdAt: eod },
    });
    await prisma.recipeCostChange.updateMany({
      where: { restaurantId: rid, createdAt: { gte: sweepFrom } },
      data: { occurredAt: eod, createdAt: eod },
    });
    process.stdout.write(di % 5 === 4 ? `${day.iso} ` : '');
  }

  await importedSales(ctx, state, ownerId, rng);

  // The daily-inventory scheduler (booted with the app context) may have frozen
  // snapshots mid-seed; drop them so every day is rebuilt from the final ledger.
  await prisma.inventoryDailyReport.deleteMany({ where: { restaurantId: rid } });

  state.counts['historyDays'] = days.length;
  state.counts['historyOrders'] = orderCount;
  state.printouts.push(
    `History: ${days.length} business days ${days[0].iso} → ${days[days.length - 1].iso}, ${orderCount} orders (both branches)`,
  );
}

// ── Restock: top-up receipts per location (items below 60% of par) ──────────
async function restock(
  ctx: SeedContext,
  state: SeedState,
  bk: BranchKey,
  day: LocalDay,
  di: number,
  suppliers: Record<LocationKey, string>,
): Promise<void> {
  const { prisma, uc } = ctx;
  const rid = RESTAURANT.id;
  const branchId = BRANCHES[bk].id;
  for (const [li, loc] of LOCATIONS.entries()) {
    const locationId = state.locationIds[bk][loc];
    const items = ITEMS.filter((i) => i.home === loc && i.kind === 'RAW' && i.openingQtyBase > 0);
    const onHand = await prisma.stockOnHand.findMany({
      where: { locationId, itemId: { in: items.map((i) => state.itemIds[bk][i.slug]) } },
      select: { itemId: true, quantity: true },
    });
    const qtyById = new Map(onHand.map((r) => [r.itemId, r.quantity]));
    const lines = items
      .map((item, idx) => {
        const itemId = state.itemIds[bk][item.slug];
        const have = qtyById.get(itemId) ?? 0;
        if (have >= item.openingQtyBase * 0.6) {
          return null;
        }
        const qty = Math.max(1, Math.round(item.openingQtyBase - Math.max(0, have)));
        // Price drifts ±8% over time → FIFO batches with different unit costs.
        const drift = 1 + 0.08 * Math.sin(di / 6 + idx * 1.7);
        return {
          itemId,
          unit: item.baseUnit,
          qty,
          lineTotalCostAmount: Math.max(1, Math.round(qty * item.costPerBase * drift)),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
    if (lines.length === 0) {
      continue;
    }
    await uc.createGoodsReceipt.execute({
      restaurantId: rid,
      branchId,
      locationId,
      supplierId: suppliers[loc],
      reference: `INV-${day.iso.replace(/-/g, '')}-${bk === 'flagship' ? 'Y' : 'G'}${li + 1}`,
      receivedAt: localTime(day, 9, 10 + li * 15),
      note: 'SEED-2 restock',
      actorUserId: state.userIdBySlug['manager'],
      lines,
    });
  }
}

// ── Production (flagship): marinade daily, tomato sauce every other day ──────
async function productionRuns(ctx: SeedContext, state: SeedState, day: LocalDay, di: number): Promise<void> {
  const { uc } = ctx;
  const branchId = BRANCHES.flagship.id;
  const actorUserId = state.userIdBySlug['chef'] ?? state.userIdBySlug['owner'];
  await uc.runProcess.execute({
    restaurantId: RESTAURANT.id,
    branchId,
    processId: state.processIds.flagship['pork-marinade'],
    multiplier: di % 7 === 5 ? 2 : 1,
    runAt: localTime(day, 10, 30),
    note: 'SEED-2 daily marinade',
    actorUserId,
  });
  if (di % 2 === 0) {
    await uc.runProcess.execute({
      restaurantId: RESTAURANT.id,
      branchId,
      processId: state.processIds.flagship['tomato-sauce-batch'],
      multiplier: 1,
      runAt: localTime(day, 11, 0),
      note: 'SEED-2 sauce batch',
      actorUserId,
    });
  }
}

// ── Orders ──────────────────────────────────────────────────────────────────
function modifierSelection(rng: Rng, state: SeedState, bk: BranchKey, dish: DishSeed): string[] {
  const ids: string[] = [];
  for (const att of dish.attachments) {
    const group = MODIFIER_GROUPS.find((g) => g.key === att.group)!;
    const required = group.required || (att as { requiredOverride?: boolean }).requiredOverride === true;
    if (!required && rng() < 0.5) {
      continue;
    }
    const opt = pick(rng, group.options);
    ids.push(state.modifierOptionIds[bk][`${att.group}:${opt.slug}`]);
  }
  return ids;
}

async function ordersForDay(
  ctx: SeedContext,
  state: SeedState,
  bk: BranchKey,
  day: LocalDay,
  rng: Rng,
): Promise<number> {
  const { uc } = ctx;
  const rid = RESTAURANT.id;
  const branchId = BRANCHES[bk].id;
  const cashierId = state.userIdBySlug[CASHIER[bk]];
  const managerId = state.userIdBySlug['owner'];
  const tables = state.tableIds[bk];

  const mult = day.weekday === 5 || day.weekday === 6 ? 1.5 : day.weekday === 0 ? 1.2 : 1;
  const n = Math.max(3, Math.round(BASE_ORDERS[bk] * mult + between(rng, -3, 3)));

  // Opening times spread 11:00–23:00 (lunch + dinner peaks), sorted.
  const starts = Array.from({ length: n }, () => {
    const peak = rng() < 0.45 ? 13 : 19.5;
    const h = Math.min(22.9, Math.max(11, peak + (rng() + rng() + rng() - 1.5) * 2.2));
    return h * 60;
  }).sort((a, b) => a - b);

  for (const startMin of starts) {
    const openedAt = localTime(day, Math.floor(startMin / 60), Math.floor(startMin % 60), between(rng, 0, 59));
    const dineIn = tables.length > 0 && rng() < 0.72;
    const waiterId = state.userIdBySlug[pick(rng, WAITERS[bk])];

    let order = await uc.createOrder.execute({
      restaurantId: rid,
      branchId,
      waiterId,
      type: dineIn ? OrderType.DINE_IN : OrderType.TAKEAWAY,
      tableId: dineIn ? pick(rng, tables) : null,
    });

    const lineCount = between(rng, 1, dineIn ? 5 : 3);
    for (let i = 0; i < lineCount; i++) {
      const dish = pick(rng, WEIGHTED);
      const qty = dish.category === 'drinks' ? between(rng, 1, 4) : between(rng, 1, 2);
      order = await uc.addOrderItem.execute({
        restaurantId: rid,
        branchId,
        orderId: order.id,
        menuItemId: state.dishIds[bk][dish.slug],
        quantity: qty,
        selectedOptionIds: modifierSelection(rng, state, bk, dish),
      });
    }

    await uc.sendToKitchen.execute({ restaurantId: rid, branchId, orderId: order.id });

    const roll = rng();
    let cancelledOrder = false;
    if (roll < 0.04) {
      // Whole order cancelled after it hit the kitchen (stock is reversed).
      await uc.cancelOrder.execute({
        restaurantId: rid,
        branchId,
        organizationId: ORG.id,
        orderId: order.id,
        reason: pick(rng, CANCEL_REASONS),
        cancelledByUserId: managerId,
      });
      cancelledOrder = true;
    } else {
      if (roll < 0.14 && order.items.length > 1) {
        // One line voided (cancellations report + consumption reversal).
        const victim = order.items[order.items.length - 1];
        order = await uc.cancelOrderItem.execute({
          restaurantId: rid,
          branchId,
          organizationId: ORG.id,
          orderId: order.id,
          itemId: victim.id,
          reason: pick(rng, CANCEL_REASONS),
          approvedByUserId: managerId,
          actorUserId: managerId,
        });
      }
      if (rng() < 0.13) {
        const percent = rng() < 0.65;
        await uc.applyDiscount.execute({
          restaurantId: rid,
          branchId,
          organizationId: ORG.id,
          orderId: order.id,
          type: percent ? DiscountType.PERCENT : DiscountType.FIXED,
          value: percent ? pick(rng, [500, 1000, 1500, 2000]) : pick(rng, [500, 1000, 2000]),
          approvedByUserId: managerId,
          actorUserId: managerId,
        });
      }
      const served = await uc.markOrderServed.execute({ restaurantId: rid, branchId, orderId: order.id });
      await pay(ctx, rng, bk, order.id, served.totalAmount, cashierId);
      await uc.closeOrder.execute({ restaurantId: rid, branchId, orderId: order.id, actorUserId: cashierId });
    }

    await backdateOrder(ctx, order.id, openedAt, cancelledOrder, rng);
  }
  return n;
}

async function pay(
  ctx: SeedContext,
  rng: Rng,
  bk: BranchKey,
  orderId: string,
  total: number,
  cashierId: string,
): Promise<void> {
  const { uc } = ctx;
  const base = { restaurantId: RESTAURANT.id, branchId: BRANCHES[bk].id, orderId, processedByUserId: cashierId };
  if (total <= 0) {
    return;
  }
  const r = rng();
  if (r < 0.07 && total > 2000) {
    // Split: part card, rest cash.
    const card = Math.round((total * between(rng, 30, 70)) / 100);
    await uc.recordPayment.execute({ ...base, method: PaymentMethod.CARD, amount: card, tenderedAmount: card });
    const rest = total - card;
    await uc.recordPayment.execute({
      ...base,
      method: PaymentMethod.CASH,
      amount: rest,
      tenderedAmount: Math.ceil(rest / 1000) * 1000,
    });
    return;
  }
  const method =
    r < 0.52 ? PaymentMethod.CASH : r < 0.9 ? PaymentMethod.CARD : r < 0.97 ? PaymentMethod.BANK_TRANSFER : PaymentMethod.OTHER;
  const tendered = method === PaymentMethod.CASH ? Math.ceil(total / 1000) * 1000 : total;
  await uc.recordPayment.execute({ ...base, method, amount: total, tenderedAmount: tendered });
}

/** Move one finished order (and everything it wrote) onto its business day. */
async function backdateOrder(
  ctx: SeedContext,
  orderId: string,
  openedAt: Date,
  cancelled: boolean,
  rng: Rng,
): Promise<void> {
  const { prisma } = ctx;
  const at = (min: number): Date => new Date(openedAt.getTime() + min * MIN);
  const sentAt = at(between(rng, 2, 6));
  const prepAt = at(between(rng, 7, 10));
  const readyAt = at(between(rng, 14, 28));
  const voidAt = at(between(rng, 8, 12));
  const closedAt = cancelled ? voidAt : at(between(rng, 40, 95));

  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { id: true } });
  const itemIds = items.map((i) => i.id);

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { createdAt: openedAt, updatedAt: closedAt },
    }),
    prisma.order.updateMany({
      where: cancelled ? { id: orderId, closedAt: { not: null } } : { id: orderId },
      data: { closedAt },
    }),
    prisma.order.updateMany({
      where: { id: orderId, fiscalizedAt: { not: null } },
      data: { fiscalizedAt: closedAt },
    }),
    prisma.orderItem.updateMany({ where: { orderId }, data: { createdAt: openedAt, updatedAt: closedAt } }),
    prisma.orderItem.updateMany({ where: { orderId, sentToKitchenAt: { not: null } }, data: { sentToKitchenAt: sentAt } }),
    prisma.orderItem.updateMany({ where: { orderId, preparingAt: { not: null } }, data: { preparingAt: prepAt } }),
    prisma.orderItem.updateMany({ where: { orderId, readyAt: { not: null } }, data: { readyAt } }),
    prisma.payment.updateMany({
      where: { orderId },
      data: { createdAt: new Date(closedAt.getTime() - MIN), updatedAt: new Date(closedAt.getTime() - MIN) },
    }),
    prisma.stockMovement.updateMany({
      where: { refType: ORDER_LINE, refId: { in: itemIds }, type: 'CONSUMPTION_OUT' },
      data: { occurredAt: sentAt, createdAt: sentAt },
    }),
    prisma.stockMovement.updateMany({
      where: { refType: ORDER_LINE, refId: { in: itemIds }, type: { not: 'CONSUMPTION_OUT' } },
      data: { occurredAt: voidAt, createdAt: voidAt },
    }),
    prisma.stockMovement.updateMany({
      where: { refType: ORDER_LINE, refId: { in: itemIds }, reversedAt: { not: null } },
      data: { reversedAt: voidAt },
    }),
  ]);
}

// ── Write-offs ──────────────────────────────────────────────────────────────
async function writeOffs(
  ctx: SeedContext,
  state: SeedState,
  bk: BranchKey,
  day: LocalDay,
  di: number,
  rng: Rng,
): Promise<void> {
  const { uc } = ctx;
  const base = {
    restaurantId: RESTAURANT.id,
    branchId: BRANCHES[bk].id,
    actorUserId: state.userIdBySlug['manager'],
  };
  const item = (slug: string, qty: number) => {
    const it = ITEMS.find((i) => i.slug === slug)!;
    return { kind: WriteOffLineKind.ITEM as const, itemId: state.itemIds[bk][slug], unit: it.baseUnit, qty };
  };

  // Spoilage of perishables every 4th day.
  if (di % 4 === (bk === 'flagship' ? 1 : 3)) {
    await uc.createWriteOff.execute({
      ...base,
      reason: WriteOffReason.SPOILAGE,
      note: 'Փչացած բանջարեղեն',
      occurredAt: localTime(day, 22, 40),
      lines: [item('tomato', between(rng, 3, 12) * 100), item(pick(rng, ['cucumber', 'parsley', 'cilantro', 'bell-pepper']), between(rng, 2, 8) * 100)],
    });
  }
  // Staff meal every 3rd day (dish write-off).
  if (di % 3 === 0) {
    const dish = pick(rng, SELLABLE.filter((d) => d.category === 'mains' || d.category === 'soups'));
    await uc.createWriteOff.execute({
      ...base,
      reason: WriteOffReason.STAFF_MEAL,
      note: 'Աշխատակազմի ճաշ',
      occurredAt: localTime(day, 16, 0),
      lines: [{ kind: WriteOffLineKind.DISH, menuItemId: state.dishIds[bk][dish.slug], units: between(rng, 2, 4) }],
    });
  }
  // Occasional breakage / waste.
  if (rng() < 0.12) {
    await uc.createWriteOff.execute({
      ...base,
      reason: WriteOffReason.BREAKAGE,
      note: 'Կոտրված շիշ',
      occurredAt: localTime(day, 21, 15),
      lines: [item(pick(rng, ['areni-red-wine', 'cola', 'mineral-water']), pick(rng, [330, 500, 750]))],
    });
  }
  if (bk === 'flagship' && di % 6 === 2) {
    await uc.createWriteOff.execute({
      ...base,
      reason: WriteOffReason.WASTE,
      note: 'Մարինադը ժամկետանց',
      occurredAt: localTime(day, 23, 0),
      lines: [item('marinated-pork-cubes', between(rng, 5, 15) * 100)],
    });
  }
}

// ── Expenses ────────────────────────────────────────────────────────────────
async function expenses(
  ctx: SeedContext,
  state: SeedState,
  bk: BranchKey,
  day: LocalDay,
  di: number,
  rng: Rng,
  cats: Record<string, string>,
): Promise<void> {
  const { prisma } = ctx;
  const rows: Array<{ cat: string | null; description: string; amount: number; hour: number }> = [];
  const scale = bk === 'flagship' ? 1 : 0.6;
  if (day.d === 1 || di === 0) {
    rows.push({ cat: 'utilities', description: 'Էլեկտրաէներգիա', amount: Math.round(185000 * scale), hour: 12 });
    rows.push({ cat: 'utilities', description: 'Գազ', amount: Math.round(96000 * scale), hour: 12 });
    rows.push({ cat: 'utilities', description: 'Ինտերնետ', amount: 15000, hour: 12 });
  }
  if (di % 7 === 3) {
    rows.push({ cat: 'supplies', description: 'Անձեռոցիկներ և լվացող միջոցներ', amount: between(rng, 18, 45) * 1000, hour: 11 });
  }
  if (di % 10 === 6) {
    rows.push({ cat: 'transport', description: 'Առաքման վառելիք', amount: between(rng, 8, 20) * 1000, hour: 15 });
  }
  if (rng() < 0.06) {
    rows.push({ cat: 'repairs', description: pick(rng, ['Սառնարանի վերանորոգում', 'Մանղալի սպասարկում', 'Աթոռ']), amount: between(rng, 15, 90) * 1000, hour: 14 });
  }
  if (bk === 'flagship' && di % 14 === 8) {
    rows.push({ cat: 'marketing', description: 'Instagram գովազդ', amount: 50000, hour: 10 });
  }
  if (rng() < 0.04) {
    rows.push({ cat: null, description: 'Այլ մանր ծախս', amount: between(rng, 2, 9) * 1000, hour: 18 });
  }
  for (const r of rows) {
    const occurredAt = localTime(day, r.hour, between(rng, 0, 59));
    await prisma.expense.create({
      data: {
        restaurantId: RESTAURANT.id,
        branchId: BRANCHES[bk].id,
        categoryId: r.cat ? cats[r.cat] : null,
        description: r.description,
        amount: r.amount,
        occurredAt,
        note: 'SEED-2',
        createdByUserId: state.userIdBySlug['manager'],
        createdAt: occurredAt,
        updatedAt: occurredAt,
      },
    });
  }
}

// ── Imported sales (legacy POS, the 14 days before the window) ───────────────
async function importedSales(ctx: SeedContext, state: SeedState, ownerId: string, rng: Rng): Promise<void> {
  const { prisma } = ctx;
  const rid = RESTAURANT.id;
  const batchId = seedId('import-batch:legacy-pos');
  const rows: Array<{
    id: string;
    restaurantId: string;
    branchId: string;
    importBatchId: string;
    occurredAt: Date;
    itemDescription: string;
    itemId: string | null;
    quantity: number;
    unitPriceAmount: number;
    lineTotalAmount: number;
    paymentMethod: string;
    externalReference: string;
  }> = [];
  let n = 0;
  for (let k = HISTORY_DAYS + 14; k > HISTORY_DAYS; k--) {
    const day = daysAgo(k);
    for (const bk of BRANCH_KEYS) {
      const lines = between(rng, 6, 14);
      for (let i = 0; i < lines; i++) {
        const dish = pick(rng, WEIGHTED);
        const qty = between(rng, 1, 3);
        n += 1;
        rows.push({
          id: seedId(`imported-sale:${n}`),
          restaurantId: rid,
          branchId: BRANCHES[bk].id,
          importBatchId: batchId,
          occurredAt: localTime(day, between(rng, 11, 22), between(rng, 0, 59)),
          itemDescription: dish.name,
          // Most rows matched to the catalog; a few left unmatched on purpose.
          itemId: rng() < 0.85 ? state.dishIds[bk][dish.slug] : null,
          quantity: qty,
          unitPriceAmount: dish.price,
          lineTotalAmount: dish.price * qty,
          paymentMethod: rng() < 0.6 ? 'CASH' : 'CARD',
          externalReference: `LEGACY-${String(n).padStart(5, '0')}`,
        });
      }
    }
  }
  await prisma.importBatch.create({
    data: {
      id: batchId,
      restaurantId: rid,
      branchId: null,
      fileName: 'legacy-pos-export.xlsx',
      importedByUserId: ownerId,
      rowCount: rows.length,
      successCount: rows.length,
      errorCount: 0,
      status: 'COMPLETED',
    },
  });
  await prisma.importedSale.createMany({ data: rows });
}
