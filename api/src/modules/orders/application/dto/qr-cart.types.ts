/** A single client-submitted cart line. Server recomputes ALL pricing from this
 *  — the client never supplies prices or totals. */
export interface CartLineInput {
  menuItemId: string;
  /** Whole-unit count (>= 1). */
  quantity: number;
  /** Selected modifier option ids (validated against the item's groups). */
  modifierOptionIds: string[];
  note?: string | null;
}

export interface CartInput {
  lines: CartLineInput[];
}
