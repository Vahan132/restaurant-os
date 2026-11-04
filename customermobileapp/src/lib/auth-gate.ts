import { useCallback } from 'react';
import { useRouter, type Router } from 'expo-router';
import { isAuthed } from '@/store/auth';
import { useIntentStore } from '@/store/intent';
import { runIntent, type PendingIntent } from './intents';

/**
 * The single auth gate (CX-APP-2) — return-to-intent.
 *
 * `requireAuth(intent?)`:
 *   - if AUTHED → run the intent's action immediately (stub until CX-3).
 *   - if ANON   → stash the intent and open the login sheet; after a successful
 *     sign-in the sheet calls `resumePendingIntent` to land back on the target and
 *     dispatch the action.
 *
 * Pass no intent (e.g. the overflow "Log in" entry) to simply open the sheet.
 */
export function useRequireAuth() {
  const router = useRouter();

  return useCallback(
    (intent?: PendingIntent) => {
      if (isAuthed()) {
        if (intent) runIntent(intent, router);
        return;
      }
      useIntentStore.getState().setPendingIntent(intent ?? null);
      router.push('/login');
    },
    [router],
  );
}

/**
 * Called after a successful sign-in. If an intent is pending, dispatch its real action
 * (open the booking sheet / perform the save), then clear it.
 */
export function resumePendingIntent(router: Router): void {
  const intent = useIntentStore.getState().consumePendingIntent();
  if (!intent) return;
  runIntent(intent, router);
}
