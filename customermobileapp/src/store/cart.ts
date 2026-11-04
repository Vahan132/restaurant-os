import { create } from 'zustand';
import type { QrCartLineDto } from '@/api/generated/model';

/**
 * Cart / ordering store (ORDER-4-FE) — the client-side ordering session.
 *
 * Holds the scanned ordering CONTEXT (restaurant/branch slugs + table `qr`, resolved
 * `branchId`), the working cart LINES, and the created order id/session once placed.
 * In-memory only (matches the filters/intent stores; no async-storage in this app) —
 * the cart does not survive a cold start, which is fine for a single dine-in visit.
 *
 * Invariants:
 *   - Cart controls render ONLY when `context` is set (an active table session). The
 *     read-only discovery/menu browse never sets a context, so it stays read-only.
 *   - Amounts here are for DISPLAY only. The server revalidates every price at
 *     validate-cart and is the sole authority on what the customer pays.
 *   - `context.restaurantSlug` is read by the axios interceptor to attach
 *     `X-Restaurant-Slug` on the `consumer/orders` calls (which carry no path slug).
 */

export interface CartLineModifier {
  modifierOptionId: string;
  groupId: string;
  name: string;
  /** Minor units; display only. */
  priceDeltaAmount: number;
}

export interface CartLine {
  /** Stable client id: menuItemId + sorted option ids, so identical configs merge. */
  lineId: string;
  menuItemId: string;
  name: string;
  /** Base unit price (minor units); display only. */
  unitPriceAmount: number;
  quantity: number;
  modifiers: CartLineModifier[];
  note?: string | null;
}

export interface OrderingContext {
  restaurantSlug: string;
  branchSlug: string;
  branchId: string;
  qr: string;
  tableName?: string | null;
}

/** Stable line id from the item + its selected option ids (order-independent). */
export function lineIdFor(menuItemId: string, modifierOptionIds: string[]): string {
  return `${menuItemId}::${[...modifierOptionIds].sort().join(',')}`;
}

/** Per-line total (unit + modifier deltas) × quantity, minor units. Display only. */
export function cartLineTotal(line: CartLine): number {
  const unit = line.unitPriceAmount + line.modifiers.reduce((s, m) => s + m.priceDeltaAmount, 0);
  return unit * line.quantity;
}

/** Client-side subtotal across all lines (minor units). Display only — server revalidates. */
export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + cartLineTotal(l), 0);
}

/** Total item count across lines (for the cart badge). */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

/** Map the cart lines to the API request shape (server recomputes all pricing). */
export function toCartLineDtos(lines: CartLine[]): QrCartLineDto[] {
  return lines.map((l) => ({
    menuItemId: l.menuItemId,
    quantity: l.quantity,
    modifierOptionIds: l.modifiers.map((m) => m.modifierOptionId),
    note: l.note ?? null,
  }));
}

interface CartState {
  context: OrderingContext | null;
  lines: CartLine[];
  /** The created (unpaid) order — set after create-order; used by confirm/receipt. */
  orderId: string | null;
  /** Returned at create; retained for the whole-table "order more" overview. */
  sessionId: string | null;

  /** Begin an ordering session for a scanned table. Resets any prior cart/order. */
  startOrdering: (context: OrderingContext) => void;
  /** Add one configured line; an identical config just increments its quantity. */
  addLine: (line: Omit<CartLine, 'lineId' | 'quantity'> & { quantity?: number }) => void;
  /** Set a line's quantity; <= 0 removes it. */
  setLineQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  /** Empty the cart but KEEP the context — the "order more" loop after a placed order. */
  clearLines: () => void;
  /** Record the placed order so the receipt/status screen can poll it. */
  setCreatedOrder: (orderId: string, sessionId: string) => void;
  /** Leave the ordering flow entirely (clear context, cart, and order). */
  endOrdering: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  context: null,
  lines: [],
  orderId: null,
  sessionId: null,

  startOrdering: (context) => set({ context, lines: [], orderId: null, sessionId: null }),

  addLine: (input) =>
    set((s) => {
      const lineId = lineIdFor(
        input.menuItemId,
        input.modifiers.map((m) => m.modifierOptionId),
      );
      const qty = input.quantity ?? 1;
      const existing = s.lines.find((l) => l.lineId === lineId);
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.lineId === lineId ? { ...l, quantity: l.quantity + qty } : l,
          ),
        };
      }
      return { lines: [...s.lines, { ...input, lineId, quantity: qty }] };
    }),

  setLineQuantity: (lineId, quantity) =>
    set((s) => ({
      lines:
        quantity <= 0
          ? s.lines.filter((l) => l.lineId !== lineId)
          : s.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
    })),

  removeLine: (lineId) => set((s) => ({ lines: s.lines.filter((l) => l.lineId !== lineId) })),

  clearLines: () => set({ lines: [], orderId: null, sessionId: null }),

  setCreatedOrder: (orderId, sessionId) => set({ orderId, sessionId }),

  endOrdering: () => set({ context: null, lines: [], orderId: null, sessionId: null }),
}));

/** Non-hook accessor for the axios interceptor: active ordering restaurant slug, or null. */
export function getOrderingRestaurantSlug(): string | null {
  return useCartStore.getState().context?.restaurantSlug ?? null;
}
