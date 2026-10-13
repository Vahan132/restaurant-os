import { deleteAccountApi, signOutApi } from '@/api/consumer';
import { useAuthStore } from '@/store/auth';
import { secureStore } from '@/lib/secure-store';

/**
 * Sign out: revoke the refresh-token family on the server (best-effort), then clear
 * the local session → anon.
 */
export async function signOut(): Promise<void> {
  const refreshToken = await secureStore.get(secureStore.keys.refreshToken);
  try {
    if (refreshToken) await signOutApi({ refreshToken });
  } catch {
    // Even if the server call fails, clear locally.
  }
  await useAuthStore.getState().clear();
}

/**
 * Delete the account on the server, then clear the local session → anon. The session
 * is cleared even if the call throws (the access token may already be invalid).
 */
export async function deleteAccount(): Promise<void> {
  try {
    await deleteAccountApi();
  } finally {
    await useAuthStore.getState().clear();
  }
}
