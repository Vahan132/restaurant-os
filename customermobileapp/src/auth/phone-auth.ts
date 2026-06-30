import { requestOtpApi, verifyOtpApi } from '@/api/consumer';
import { useAuthStore } from '@/store/auth';
import { normalizeE164 } from '@/lib/phone';

/** Step 1: request an OTP for a phone (E.164-normalized) in the given locale. */
export async function requestPhoneOtp(phone: string, locale: string): Promise<void> {
  await requestOtpApi({ phone: normalizeE164(phone), locale });
}

/** Step 2: verify the OTP → set the session (authed). */
export async function verifyPhoneOtp(phone: string, code: string): Promise<void> {
  const session = await verifyOtpApi({ phone: normalizeE164(phone), code });
  await useAuthStore.getState().setSession(session);
}
