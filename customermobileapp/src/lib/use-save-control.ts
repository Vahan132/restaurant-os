import { Alert } from 'react-native';
import i18n from '@/i18n';
import { isAuthed } from '@/store/auth';
import { useRequireAuth } from '@/lib/auth-gate';
import {
  useIsBranchSaved,
  performSave,
  performUnsave,
  type OptimisticSavedCard,
} from '@/api/saved';

/**
 * Shared save/unsave control for the discovery card and the detail screen.
 *
 * Returns the reactive saved state (derived from the `/consumer/saved` list, the single
 * source of truth) and a `toggle` that:
 *   - unsaves immediately (optimistic) when already saved — the user is authed,
 *   - saves immediately (optimistic, with the card's data) when authed,
 *   - otherwise routes through `requireAuth` so an anonymous tap signs in then resumes
 *     the save.
 */
export function useSaveControl(card: OptimisticSavedCard) {
  const isSaved = useIsBranchSaved(card.branchId);
  const requireAuth = useRequireAuth();

  function toggle() {
    const onErr = () => {
      const t = i18n.getFixedT(null, 'common');
      Alert.alert(t('error.generic'));
    };
    if (isSaved) {
      performUnsave(card.branchId).catch(onErr);
      return;
    }
    if (isAuthed()) {
      performSave(card).catch(onErr);
    } else {
      requireAuth({ type: 'save', branchId: card.branchId });
    }
  }

  return { isSaved, toggle };
}
