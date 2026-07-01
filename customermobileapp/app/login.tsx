import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { signInGoogleApi } from '@/api/consumer';
import { signInWithApple } from '@/auth/apple-auth';
import { requestPhoneOtp, verifyPhoneOtp } from '@/auth/phone-auth';
import { useAuthStore } from '@/store/auth';
import { resumePendingIntent } from '@/lib/auth-gate';
import { apiErrorMessage } from '@/lib/api-error';
import { looksLikeE164 } from '@/lib/phone';
import { useLocale } from '@/i18n/useLocale';
import { colors } from '@/theme/theme';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'methods' | 'phone' | 'code';

const googleClientIds = (Constants.expoConfig?.extra ?? {}) as {
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  googleWebClientId?: string;
};

/**
 * Login sheet (CX-APP-2) — real consumer auth: Google / Apple / phone-OTP. On any
 * success → session is set, the sheet dismisses, and the pending intent resumes.
 */
export default function LoginSheet() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const setSession = useAuthStore((s) => s.setSession);

  const [mode, setMode] = useState<Mode>('methods');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, googleResponse, googlePrompt] = Google.useIdTokenAuthRequest({
    iosClientId: googleClientIds.googleIosClientId,
    androidClientId: googleClientIds.googleAndroidClientId,
    webClientId: googleClientIds.googleWebClientId,
  });

  // Exchange the Google ID token for a session when the native flow returns.
  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params?.id_token;
    if (!idToken) return;
    void run(async () => {
      const session = await signInGoogleApi({ idToken });
      await setSession(session);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  function dismissAndResume() {
    router.back();
    resumePendingIntent(router);
  }

  /** Wrap an auth action: manage busy/error and resume on success. */
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      dismissAndResume();
    } catch (e) {
      setError(apiErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  // Google opens the native flow; the ID-token exchange + resume run in the useEffect.
  const onGoogle = async () => {
    setError(null);
    try {
      await googlePrompt();
    } catch (e) {
      setError(apiErrorMessage(e, t));
    }
  };

  const onApple = () => run(() => signInWithApple());

  // Phone step 1: request the code, advance to the code step (no resume yet).
  async function handleRequestOtp() {
    setBusy(true);
    setError(null);
    try {
      await requestPhoneOtp(phone, locale);
      setMode('code');
    } catch (e) {
      setError(apiErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  // Phone step 2: verify → session → resume.
  const handleVerifyOtp = () => run(() => verifyPhoneOtp(phone, code));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable className="absolute inset-0" accessibilityLabel="Close" onPress={() => router.back()} />

      <View className="rounded-t-3xl bg-surface px-6 pb-10 pt-3">
        <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-border" />

        <View className="mb-3 flex-row items-center">
          {mode !== 'methods' ? (
            <Pressable hitSlop={8} onPress={() => setMode('methods')} className="mr-2 active:opacity-70">
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <View className="flex-1">
            <Text className="text-xl font-bold text-text">{t('login.title')}</Text>
            {mode === 'methods' ? (
              <Text className="mt-1 text-sm text-textMuted">{t('login.subtitle')}</Text>
            ) : null}
          </View>
        </View>

        {error ? <Text className="mb-3 text-sm text-accent">{error}</Text> : null}

        {mode === 'methods' ? (
          <View>
            <Pressable
              disabled={busy}
              onPress={onGoogle}
              className="mb-3 flex-row items-center justify-center rounded-xl bg-text py-3.5 active:opacity-80"
            >
              <Ionicons name="logo-google" size={18} color={colors.bg} />
              <Text className="ml-2 font-semibold" style={{ color: colors.bg }}>
                {t('login.google')}
              </Text>
            </Pressable>

            {Platform.OS === 'ios' ? (
              <Pressable
                disabled={busy}
                onPress={onApple}
                className="mb-3 flex-row items-center justify-center rounded-xl bg-text py-3.5 active:opacity-80"
              >
                <Ionicons name="logo-apple" size={20} color={colors.bg} />
                <Text className="ml-2 font-semibold" style={{ color: colors.bg }}>
                  {t('login.apple')}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={busy}
              onPress={() => {
                setError(null);
                setMode('phone');
              }}
              className="mb-4 flex-row items-center justify-center rounded-xl border border-border py-3.5 active:opacity-80"
            >
              <Ionicons name="call-outline" size={18} color={colors.text} />
              <Text className="ml-2 font-semibold text-text">{t('login.phone')}</Text>
            </Pressable>

            <Text className="text-center text-xs text-textFaint">{t('login.terms')}</Text>
          </View>
        ) : null}

        {mode === 'phone' ? (
          <View>
            <Text className="mb-2 text-sm text-textMuted">{t('login.phonePrompt')}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoFocus
              placeholder="+374 ..."
              placeholderTextColor={colors.textFaint}
              className="mb-4 h-12 rounded-xl bg-surfaceAlt px-4 text-text"
              style={{ color: colors.text }}
            />
            <PrimaryButton
              label={t('login.sendCode')}
              busy={busy}
              disabled={!looksLikeE164(phone)}
              onPress={handleRequestOtp}
            />
          </View>
        ) : null}

        {mode === 'code' ? (
          <View>
            <Text className="mb-2 text-sm text-textMuted">{t('login.codePrompt', { phone })}</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
              placeholder="••••••"
              placeholderTextColor={colors.textFaint}
              maxLength={8}
              className="mb-4 h-12 rounded-xl bg-surfaceAlt px-4 text-center text-lg tracking-[6px] text-text"
              style={{ color: colors.text }}
            />
            <PrimaryButton
              label={t('login.verify')}
              busy={busy}
              disabled={code.length < 4}
              onPress={handleVerifyOtp}
            />
            <Pressable disabled={busy} onPress={handleRequestOtp} className="mt-3 items-center active:opacity-70">
              <Text className="text-sm text-accent">{t('login.resend')}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function PrimaryButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={busy || disabled}
      onPress={onPress}
      className={`h-12 flex-row items-center justify-center rounded-xl bg-accent active:opacity-80 ${
        busy || disabled ? 'opacity-50' : ''
      }`}
    >
      {busy ? (
        <ActivityIndicator color={colors.accentText} />
      ) : (
        <Text className="font-semibold text-accentText">{label}</Text>
      )}
    </Pressable>
  );
}
