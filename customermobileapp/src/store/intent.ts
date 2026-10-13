import { create } from 'zustand';
import type { PendingIntent } from '@/lib/intents';

/**
 * Holds the single pending intent across the login round-trip (return-to-intent).
 * Set when an anonymous user taps a gated control; consumed after successful sign-in.
 */
interface IntentState {
  pendingIntent: PendingIntent | null;
  setPendingIntent: (intent: PendingIntent | null) => void;
  consumePendingIntent: () => PendingIntent | null;
}

export const useIntentStore = create<IntentState>((set, get) => ({
  pendingIntent: null,
  setPendingIntent: (intent) => set({ pendingIntent: intent }),
  consumePendingIntent: () => {
    const intent = get().pendingIntent;
    set({ pendingIntent: null });
    return intent;
  },
}));
