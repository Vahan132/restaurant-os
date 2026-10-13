/**
 * Phase 11 — ~1 business day of orders per branch across states (decision J),
 * driven entirely through the REAL order use-cases so served/closed orders
 * deplete inventory through the BOM path:
 *
 *   create → addItem(×n) → sendToKitchen   ← fires CONSUMPTION_OUT via the
 *   inventory listener (FIFO depletion of each line's recipe) → markServed →
 *   recordPayment(full) → close.
 *
 * Also leaves a DRAFT + a SENT order open, and cancels one, so the order set
 * spans the lifecycle. DINE_IN orders take distinct tables (one-open-order-per-
 * table is enforced); TAKEAWAY orders take none.
 */
import type { SeedContext } from '../context';
import type { SeedState } from '../state';
import { ORG, RESTAURANT, BRANCHES } from '../data/core';
import type { BranchKey } from '../data/iam';
import { DISHES, MODIFIER_GROUPS } from '../data/menu';
import type { ModifierGroupKey } from '../data/menu';
import { OrderType, PaymentMethod } from '../../../src/modules/orders/domain/enums';

type Target = 'CLOSED' | 'SERVED' | 'SENT' | 'DRAFT' | 'CANCELLED';

interface OrderLineSeed {
  dish: string;
  qty: number;
}
interface OrderSeed {
  target: Target;
  dineIn: boolean;
  tableIndex?: number;
  lines: OrderLineSeed[];
}

const ORDERS: OrderSeed[] = [
  { target: 'CLOSED', dineIn: true, tableIndex: 0, lines: [{ dish: 'pork-khorovats', qty: 2 }, { dish: 'cola-glass', qty: 2 }] },
  { target: 'CLOSED', dineIn: true, tableIndex: 1, lines: [{ dish: 'chicken-khorovats', qty: 1 }, { dish: 'summer-salad', qty: 1 }, { dish: 'areni-wine-glass', qty: 2 }] },
  { target: 'SERVED', dineIn: true, tableIndex: 2, lines: [{ dish: 'lyulya-kebab', qty: 2 }, { dish: 'tarragon-lemonade-glass', qty: 2 }] },
  { target: 'CLOSED', dineIn: false, lines: [{ dish: 'armenian-coffee', qty: 2 }, { dish: 'gata', qty: 2 }] },
  { target: 'CLOSED', dineIn: false, lines: [{ dish: 'harissa', qty: 1 }, { dish: 'black-tea-cup', qty: 1 }] },
  { target: 'SENT', dineIn: true, tableIndex: 3, lines: [{ dish: 'khash', qty: 1 }, { dish: 'lavash', qty: 3 }] },
  { target: 'DRAFT', dineIn: true, tableIndex: 4, lines: [{ dish: 'dolma', qty: 1 }, { dish: 'cola-glass', qty: 1 }] },
  { target: 'CANCELLED', dineIn: false, lines: [{ dish: 'fried-potato', qty: 1 }] },
];

const BRANCH_KEYS: BranchKey[] = ['flagship', 'second'];

const WAITER_BY_BRANCH: Record<BranchKey, string> = {
  flagship: 'waiter-flagship',
  second: 'waiter-gyumri',
};
const CASHIER_BY_BRANCH: Record<BranchKey, string> = {
  flagship: 'cashier-flagship',
  second: 'cashier-gyumri',
};

function defaultOptionSlug(key: ModifierGroupKey): string {
  const group = MODIFIER_GROUPS.find((g) => g.key === key)!;
  return (group.options.find((o) => o.isDefault) ?? group.options[0]).slug;
}

export async function seedOrders(ctx: SeedContext, state: SeedState): Promise<void> {
  const { uc } = ctx;
  const rid = RESTAURANT.id;
  const dishBySlug = new Map(DISHES.map((d) => [d.slug, d]));

  for (const bk of BRANCH_KEYS) {
    const branchId = BRANCHES[bk].id;
    const waiterId = state.userIdBySlug[WAITER_BY_BRANCH[bk]];
    const cashierId = state.userIdBySlug[CASHIER_BY_BRANCH[bk]];
    const tables = state.tableIds[bk];

    for (const spec of ORDERS) {
      const tableId =
        spec.dineIn && spec.tableIndex !== undefined ? tables[spec.tableIndex] : null;

      let order = await uc.createOrder.execute({
        restaurantId: rid,
        branchId,
        waiterId,
        type: spec.dineIn ? OrderType.DINE_IN : OrderType.TAKEAWAY,
        tableId,
      });

      for (const line of spec.lines) {
        const dish = dishBySlug.get(line.dish)!;
        const selectedOptionIds = dish.attachments.map(
          (att) => state.modifierOptionIds[bk][`${att.group}:${defaultOptionSlug(att.group)}`],
        );
        order = await uc.addOrderItem.execute({
          restaurantId: rid,
          branchId,
          orderId: order.id,
          menuItemId: state.dishIds[bk][line.dish],
          quantity: line.qty,
          selectedOptionIds,
        });
      }

      if (spec.target === 'DRAFT') {
        continue;
      }

      // Send to kitchen — this is what depletes inventory through the ledger.
      await uc.sendToKitchen.execute({ restaurantId: rid, branchId, orderId: order.id });

      if (spec.target === 'SENT') {
        continue;
      }
      if (spec.target === 'CANCELLED') {
        await uc.cancelOrder.execute({
          restaurantId: rid,
          branchId,
          organizationId: ORG.id,
          orderId: order.id,
          reason: 'Հաճախորդը հրաժարվեց պատվերից',
          cancelledByUserId: cashierId,
        });
        continue;
      }

      const served = await uc.markOrderServed.execute({ restaurantId: rid, branchId, orderId: order.id });

      if (spec.target === 'SERVED') {
        continue;
      }

      // CLOSED: pay in full, then close.
      await uc.recordPayment.execute({
        restaurantId: rid,
        branchId,
        orderId: order.id,
        method: PaymentMethod.CASH,
        amount: served.totalAmount,
        tenderedAmount: served.totalAmount,
        processedByUserId: cashierId,
      });
      await uc.closeOrder.execute({
        restaurantId: rid,
        branchId,
        orderId: order.id,
        actorUserId: cashierId,
      });
    }
  }
}
