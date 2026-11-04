import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import {
  confirmPhoneChangeApi,
  requestPhoneChangeApi,
  updateProfileApi,
  useGetMe,
} from '@/api/consumer';
import { deleteAccount, signOut } from '@/auth/account-actions';
import { useAuthStore } from '@/store/auth';
import { apiErrorMessage } from '@/lib/api-error';
import { looksLikeE164 } from '@/lib/phone';
import { useLocale } from '@/i18n/useLocale';
import { colors } from '@/theme/theme';

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED';

export default function ProfileScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  if (status !== 'authed') {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Ionicons name="person-circle-outline" size={56} color={colors.textFaint} />
          <Text className="mb-1 mt-3 text-xl font-semibold text-text">
            {t('screens.profileTitle')}
          </Text>
          <Text className="mb-5 text-center text-textMuted">{t('profile.signInPrompt')}</Text>
          <Pressable
            onPress={() => router.push('/login')}
            className="rounded-xl bg-accent px-6 py-3 active:opacity-80"
          >
            <Text className="font-semibold text-accentText">{t('overflow.login')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return <AuthedProfile />;
}

function AuthedProfile() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { locale } = useLocale();
  const { data, isPending, isError, refetch } = useGetMe();

  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthday, setBirthday] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setName(data.name ?? '');
      setGender((data.gender as Gender | null) ?? null);
      setBirthday(data.birthday ?? '');
    }
  }, [data]);

  if (isPending) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-textMuted">{t('error.generic')}</Text>
          <Pressable onPress={() => refetch()} className="rounded-xl bg-accent px-5 py-3">
            <Text className="font-semibold text-accentText">{t('error.retry')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    try {
      // Only name/gender/birthday — NEVER email (backend rejects with EMAIL_IMMUTABLE).
      await updateProfileApi({
        name: name.trim() ? name.trim() : null,
        gender: gender ?? undefined,
        birthday: birthday.trim() ? birthday.trim() : null,
      });
      await refetch();
      Alert.alert(t('profile.saved'));
    } catch (e) {
      setSaveError(apiErrorMessage(e, t));
    } finally {
      setSaving(false);
    }
  }

  function onLogout() {
    void signOut();
  }

  function onDelete() {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('profile.deleteConfirmAction'),
        style: 'destructive',
        onPress: () => {
          void deleteAccount().then(() => router.replace('/'));
        },
      },
    ]);
  }

  return (
    <Screen className="px-0">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        <View className="flex-row items-center justify-between pb-2 pt-2">
          <Text className="text-3xl font-bold text-text">{t('screens.profileTitle')}</Text>
          <Pressable onPress={onLogout} hitSlop={8} className="active:opacity-70">
            <Text className="font-semibold text-accent">{t('profile.logout')}</Text>
          </Pressable>
        </View>

        <View className="mb-6 mt-2 items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-surfaceAlt">
            <Ionicons name="person" size={36} color={colors.textFaint} />
          </View>
          <Text className="mt-3 text-lg font-semibold text-text">{data.name ?? '—'}</Text>
          {data.email ? <Text className="text-textMuted">{data.email}</Text> : null}
        </View>

        <Text className="mb-2 text-xs uppercase tracking-wide text-textFaint">
          {t('profile.personalInfo')}
        </Text>

        <Field label={t('profile.name')}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('profile.name')}
            placeholderTextColor={colors.textFaint}
            style={{ color: colors.text }}
          />
        </Field>

        <Field label={t('profile.email')}>
          <Text className="text-textMuted">{data.email ?? '—'}</Text>
          <Text className="mt-0.5 text-xs text-textFaint">{t('profile.emailReadonly')}</Text>
        </Field>

        <Field label={t('profile.gender')}>
          <View className="flex-row">
            <GenderChip label={t('profile.male')} active={gender === 'MALE'} onPress={() => setGender('MALE')} />
            <GenderChip label={t('profile.female')} active={gender === 'FEMALE'} onPress={() => setGender('FEMALE')} />
          </View>
        </Field>

        <Field label={t('profile.birthday')}>
          <TextInput
            value={birthday}
            onChangeText={setBirthday}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            style={{ color: colors.text }}
          />
        </Field>

        {saveError ? <Text className="mb-2 text-sm text-accent">{saveError}</Text> : null}

        <Pressable
          disabled={saving}
          onPress={onSave}
          className={`mb-6 h-12 flex-row items-center justify-center rounded-xl bg-accent active:opacity-80 ${
            saving ? 'opacity-50' : ''
          }`}
        >
          {saving ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text className="font-semibold text-accentText">{t('profile.saveChanges')}</Text>
          )}
        </Pressable>

        <Text className="mb-2 text-xs uppercase tracking-wide text-textFaint">
          {t('profile.phoneSection')}
        </Text>
        <PhoneChange currentPhone={data.phone} locale={locale} onChanged={() => refetch()} />

        <Pressable onPress={onDelete} className="mt-8 items-center active:opacity-70">
          <Text className="text-sm font-semibold text-accent underline">
            {t('profile.deleteAction')}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-4 rounded-xl bg-surface px-4 py-3">
      <Text className="mb-1 text-xs text-textFaint">{label}</Text>
      {children}
    </View>
  );
}

function GenderChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full border px-5 py-2 active:opacity-80 ${
        active ? 'border-accent bg-accent' : 'border-border bg-surfaceAlt'
      }`}
    >
      <Text className={active ? 'font-semibold text-accentText' : 'text-text'}>{label}</Text>
    </Pressable>
  );
}

/** Inline phone-change flow: current → new phone → OTP code → confirm. */
function PhoneChange({
  currentPhone,
  locale,
  onChanged,
}: {
  currentPhone: string | null;
  locale: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation('common');
  const [mode, setMode] = useState<'idle' | 'new' | 'code'>('idle');
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      await requestPhoneChangeApi({ newPhone, locale });
      setMode('code');
    } catch (e) {
      setError(apiErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await confirmPhoneChangeApi({ newPhone, code });
      setMode('idle');
      setNewPhone('');
      setCode('');
      onChanged();
      Alert.alert(t('profile.phoneChanged'));
    } catch (e) {
      setError(apiErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="rounded-xl bg-surface px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-textFaint">{t('profile.phone')}</Text>
          <Text className="text-text">{currentPhone ?? '—'}</Text>
        </View>
        {mode === 'idle' ? (
          <Pressable onPress={() => setMode('new')} className="active:opacity-70">
            <Text className="font-semibold text-accent">{t('profile.change')}</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? <Text className="mt-2 text-sm text-accent">{error}</Text> : null}

      {mode === 'new' ? (
        <View className="mt-3">
          <TextInput
            value={newPhone}
            onChangeText={setNewPhone}
            keyboardType="phone-pad"
            placeholder="+374 ..."
            placeholderTextColor={colors.textFaint}
            className="mb-3 h-11 rounded-xl bg-surfaceAlt px-3"
            style={{ color: colors.text }}
          />
          <InlineButton
            label={t('login.sendCode')}
            busy={busy}
            disabled={!looksLikeE164(newPhone)}
            onPress={request}
          />
        </View>
      ) : null}

      {mode === 'code' ? (
        <View className="mt-3">
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            placeholder="••••••"
            placeholderTextColor={colors.textFaint}
            maxLength={8}
            className="mb-3 h-11 rounded-xl bg-surfaceAlt px-3 text-center tracking-[6px]"
            style={{ color: colors.text }}
          />
          <InlineButton
            label={t('login.verify')}
            busy={busy}
            disabled={code.length < 4}
            onPress={confirm}
          />
        </View>
      ) : null}
    </View>
  );
}

function InlineButton({
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
      className={`h-11 items-center justify-center rounded-xl bg-accent active:opacity-80 ${
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
