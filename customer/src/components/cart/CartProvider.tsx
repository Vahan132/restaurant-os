'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { resolveSlug, resolveTableQr } from '@/lib/tenant';
import {
  cartCount,
  cartSubtotal,
  lineTotal as computeLineTotal,
  type CartLine,
} from '@/lib/cart';

interface CartState {
  lines: CartLine[];
}

type CartAction =
  | { type: 'hydrate'; lines: CartLine[] }
  | { type: 'add'; line: CartLine }
  | { type: 'setQty'; id: string; quantity: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'hydrate':
      return { lines: action.lines };
    case 'add':
      return { lines: [...state.lines, action.line] };
    case 'setQty': {
      const quantity = Math.max(1, Math.round(action.quantity));
      return {
        lines: state.lines.map((l) =>
          l.id === action.id
            ? { ...l, quantity, lineTotal: computeLineTotal(l.basePriceAmount, l.modifiers, quantity) }
            : l,
        ),
      };
    }
    case 'remove':
      return { lines: state.lines.filter((l) => l.id !== action.id) };
    case 'clear':
      return { lines: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  addLine: (line: CartLine) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeLine: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_PREFIX = 'resqr.cart';

/**
 * Cart state persisted to localStorage, keyed by restaurant slug + table qr,
 * so a refresh keeps the cart for that table and a different table starts fresh.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: [] });
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  // Resolve the per-table storage key on the client, then hydrate from storage.
  useEffect(() => {
    const slug = resolveSlug() || 'unknown';
    const qr = resolveTableQr() ?? 'no-table';
    const key = `${STORAGE_PREFIX}:${slug}:${qr}`;
    setStorageKey(key);
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as CartLine[];
        if (Array.isArray(parsed)) dispatch({ type: 'hydrate', lines: parsed });
      }
    } catch {
      /* ignore corrupt storage */
    }
    hydratedRef.current = true;
  }, []);

  // Persist on every change (after hydration).
  useEffect(() => {
    if (!storageKey || !hydratedRef.current) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state.lines));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, [state.lines, storageKey]);

  const addLine = useCallback((line: CartLine) => dispatch({ type: 'add', line }), []);
  const setQuantity = useCallback(
    (id: string, quantity: number) => dispatch({ type: 'setQty', id, quantity }),
    [],
  );
  const removeLine = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines: state.lines,
      count: cartCount(state.lines),
      subtotal: cartSubtotal(state.lines),
      addLine,
      setQuantity,
      removeLine,
      clear,
    }),
    [state.lines, addLine, setQuantity, removeLine, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
