import * as AppleAuthentication from 'expo-apple-authentication';
import { signInAppleApi } from '@/api/consumer';
import { useAuthStore } from '@/store/auth';

/**
 * Native Apple sign-in. Obtains the identity token; on the FIRST authorization Apple
 * also returns name/email (never again) — forwarded as firstAuthName/firstAuthEmail.
 * The backend verifies the token against Apple JWKS and issues our session.
 *
 * Requires a dev build (native module — not available in Expo Go). iOS only.
 */
export async function signInWithApple(): Promise<void> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token.');
  }

  const firstAuthName = credential.fullName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ').trim()
    : undefined;

  const session = await signInAppleApi({
    idToken: credential.identityToken,
    firstAuthName: firstAuthName || undefined,
    firstAuthEmail: credential.email ?? undefined,
  });
  await useAuthStore.getState().setSession(session);
}
