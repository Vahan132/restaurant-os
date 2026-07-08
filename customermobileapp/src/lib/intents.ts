import { Alert } from 'react-native';
import type { Router } from 'expo-router';
import i18n from '@/i18n';
import { performSave } from '@/api/saved';
import { useCartStore, type OrderingContext } from '@/store/cart';

/** A deferred action captured when an anonymous user taps a gated control. */
export type PendingIntent =
  | { type: 'book'; branchId: string }
  | { type: 'save'; branchId: string }
  /** ORDER-4: resume into the ordering flow after the auth gate (scan requires login). */
  | { type: 'order'; context: OrderingContext };

/**
 * Dispatch the intent's action (CX-APP-3 — real handlers):
 *   - `book`  → open the booking sheet on that branch.
 *   - `save`  → perform the save (optimistic; the saved query is the source of truth).
 *   - `order` → begin the ordering session for the scanned table and open its menu.
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
    case 'order':
      // Set the ordering context (cart controls now render on this branch's menu) and
      // replace the scanner with the branch menu in ordering mode.
      useCartStore.getState().startOrdering(intent.context);
      router.replace({
        pathname: '/menu/[branchId]',
        params: { branchId: intent.context.branchId },
      });
      break;
  }
}
