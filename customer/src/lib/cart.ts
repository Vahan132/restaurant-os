import type {
  OrderRequestItemDto,
  PublicMenuItemResponse,
  QrCartDto,
} from '@/api/generated/model';

/** A single selected modifier option, snapshotted at add-to-cart time. */
export interface CartModifierSelection {
  modifierGroupId: string;
  modifierOptionId: string;
  name: string;
  priceDelta: number; // minor units
}

/** A line in the cart. Prices are snapshots in minor units. */
export interface CartLine {
  id: string; // unique per line (same item with different mods = different lines)
  menuItemId: string;
  nameSnapshot: string;
  basePriceAmount: number; // minor units
  modifiers: CartModifierSelection[];
  quantity: number;
  note: string | null;
  lineTotal: number; // computed: unitPrice * quantity (minor units)
}

/** Unit price = base + sum of selected modifier deltas (minor units). */
export function unitPrice(basePriceAmount: number, modifiers: CartModifierSelection[]): number {
  return modifiers.reduce((sum, m) => sum + m.priceDelta, basePriceAmount);
}

export function lineTotal(
  basePriceAmount: number,
  modifiers: CartModifierSelection[],
  quantity: number,
): number {
  return unitPrice(basePriceAmount, modifiers) * quantity;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.lineTotal, 0);
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Build a cart line from an item + the picker's selections. */
export function buildCartLine(
  item: Pick<PublicMenuItemResponse, 'id' | 'name' | 'priceAmount'>,
  modifiers: CartModifierSelection[],
  quantity: number,
  note: string | null,
): CartLine {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    menuItemId: item.id,
    nameSnapshot: item.name,
    basePriceAmount: item.priceAmount,
    modifiers,
    quantity,
    note: note && note.trim() ? note.trim() : null,
    lineTotal: lineTotal(item.priceAmount, modifiers, quantity),
  };
}

/**
 * Map cart lines to the QR-web PREPAYMENT cart payload (ORDER-2:
 * `QrCartDto`, used by both validate-cart and create-order).
 *
 * This is DISTINCT from `toOrderItems` (the older pay-at-table order-requests
 * flow): `QrCartLineDto` takes a FLAT `modifierOptionIds` array (no group ids,
 * no snapshot names/prices) — the server recomputes everything from the ids, so
 * the client never sends authoritative prices.
 *
 * NOTE: `note` is intentionally omitted. The generated `QrCartLineDto.note`
 * type is `{ [key: string]: unknown } | null` (a loosely-typed object, not a
 * string), so the shape the backend expects for a free-text line note is
 * ambiguous. Line notes are kept in the local cart for the customer's own
 * reference but not sent on prepay until the backend note contract is pinned
 * down. See customer/ORDER-2-FE.findings.md, NOTE #5.
 */
export function toQrCart(lines: CartLine[]): QrCartDto {
  return {
    lines: lines.map((l) => ({
      menuItemId: l.menuItemId,
      quantity: l.quantity,
      modifierOptionIds: l.modifiers.map((m) => m.modifierOptionId),
    })),
  };
}

/** Map cart lines to the POST /public/order-requests items payload. */
export function toOrderItems(lines: CartLine[]): OrderRequestItemDto[] {
  return lines.map((l) => ({
    menuItemId: l.menuItemId,
    quantity: l.quantity,
    modifiers: l.modifiers.map((m) => ({
      modifierGroupId: m.modifierGroupId,
      modifierOptionId: m.modifierOptionId,
    })),
    ...(l.note ? { note: l.note } : {}),
  }));
}
