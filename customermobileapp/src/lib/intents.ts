import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import i18n from '@/i18n';
import { performSave } from '@/api/saved';

/** A deferred action captured when an anonymous user taps a gated control. */
export type PendingIntent =
  | { type: 'book'; branchId: string }
  | { type: 'save'; branchId: string };

/**
 * Dispatch the intent's action (CX-APP-3 — real handlers):
 *   - `book` → open the booking sheet on that branch.
 *   - `save` → perform the save (optimistic; the saved query is the source of truth).
 *
 * Called both on the immediate (already-authed) path and after a sign-in resume.
 */
export function runIntent(intent: PendingIntent, router: Router): void {
  switch (intent.type) {
    case 'book':
      router.push({ pathname: '/booking', params: { branchId: intent.branchId } });
      break;
    case 'save':
      performSave({ branchId: intent.branchId }).catch(() => {
        const t = i18n.getFixedT(null, 'common');
        Alert.alert(t('error.generic'));
      });
      break;
  }
}
