import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePublicDiscoveryControllerDetail } from '@/api/generated/discovery/discovery';
import {
  useSlots,
  useCreateReservation,
  invalidateReservations,
  type ConsumerReservationConfirmationResponse,
} from '@/api/booking';
import { Skeleton } from '@/components/Skeleton';
import { isApiError, apiErrorMessage } from '@/lib/api-error';
import { useLocale } from '@/i18n/useLocale';
import { formatTime, forwardDays, dateStripLabel } from '@/lib/datetime';
import { colors } from '@/theme/theme';

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];
const DATE_RANGE_DAYS = 30;

/**
 * Booking sheet (CX-APP-3) — opened by the gated "Book a table" intent.
 *
 * Identity (name/phone) is read server-side from the profile, so the form only captures
 * date, time (from the engine's slots), party size (required), and an optional note.
 * Slots are rendered exactly as the engine returns them: available selectable,
 * unavailable visible-but-disabled (no client-side slot math).
 */
export default function BookingSheet() {
  const { branchId } = useLocalSearchParams<{ branchId: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { locale } = useLocale();

  const days = forwardDays(DATE_RANGE_DAYS);
  const [partySize, setPartySize] = useState(2);
  const [dateKey, setDateKey] = useState(days[0].key);
  const [note, setNote] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<ConsumerReservationConfirmationResponse | null>(null);

  const detail = usePublicDiscoveryControllerDetail(branchId);
  const slots = useSlots(branchId, { date: dateKey, partySize });
  const create = useCreateReservation();

  const reservationsPublic = detail.data?.reservationsPublic ?? true;
  const restaurantName = detail.data?.name ?? '';

  const close = () => router.back();

  const goToReservations = () => {
    router.back();
    router.navigate('/reservations');
  };

  function pickDate(key: string) {
    setDateKey(key);
    setSelectedTime(null);
    setError(null);
  }

  function pickParty(size: number) {
    setPartySize(size);
    setSelectedTime(null);
    setError(null);
  }

  function confirm() {
    if (!selectedTime) return;
    setError(null);
    create.mutate(
      { data: { branchId, date: dateKey, time: selectedTime, partySize, note: note.trim() || undefined } },
      {
        onSuccess: (data) => {
          invalidateReservations();
          setConfirmation(data);
        },
        onError: (e) => {
          const code = isApiError(e) ? e.code : '';
          if (code === 'SLOT_UNAVAILABLE') {
            setSelectedTime(null);
            void slots.refetch();
            setError(t('apiErrors.SLOT_UNAVAILABLE'));
          } else if (code === 'RESERVATIONS_NOT_PUBLIC') {
            setError(t('apiErrors.RESERVATIONS_NOT_PUBLIC'));
          } else {
            setError(apiErrorMessage(e, t));
          }
        },
      },
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable className="absolute inset-0" accessibilityLabel={t('booking.close')} onPress={close} />

      <View className="max-h-[88%] rounded-t-3xl bg-surface pb-8 pt-3">
        <View className="mb-3 h-1.5 w-12 self-center rounded-full bg-border" />

        {/* Header */}
        <View className="flex-row items-center px-6">
          <View className="flex-1">
            <Text className="text-xl font-bold text-text">{t('booking.title')}</Text>
            {restaurantName ? (
              <Text className="mt-0.5 text-sm text-textMuted" numberOfLines={1}>
                {restaurantName}
              </Text>
            ) : null}
          </View>
          <Pressable hitSlop={8} onPress={close} className="ml-2 p-1 active:opacity-70">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Reservations not public — defensive guard */}
        {!reservationsPublic ? (
          <View className="items-center px-8 py-10">
            <Ionicons name="lock-closed-outline" size={40} color={colors.textFaint} />
            <Text className="mt-4 text-center text-base text-textMuted">
              {t('apiErrors.RESERVATIONS_NOT_PUBLIC')}
            </Text>
            <Pressable
              onPress={close}
              className="mt-6 rounded-xl border border-border px-6 py-3 active:opacity-80"
            >
              <Text className="font-semibold text-text">{t('booking.close')}</Text>
            </Pressable>
          </View>
        ) : confirmation ? (
          /* Confirmation state — PENDING, awaiting restaurant */
          <View className="items-center px-8 py-8">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-surfaceAlt">
              <Ionicons name="hourglass-outline" size={32} color={colors.accent} />
            </View>
            <Text className="mt-4 text-center text-lg font-bold text-text">
              {t('booking.pendingTitle')}
            </Text>
            <Text className="mt-2 text-center text-sm text-textMuted">
              {t('booking.pendingBody')}
            </Text>
            <Pressable
              onPress={goToReservations}
              className="mt-7 w-full items-center rounded-xl bg-accent py-3.5 active:opacity-80"
            >
              <Text className="font-semibold text-accentText">{t('booking.viewReservations')}</Text>
            </Pressable>
            <Pressable onPress={close} className="mt-3 items-center active:opacity-70">
              <Text className="text-sm text-textMuted">{t('booking.done')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            className="px-6"
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Party size */}
            <Text className="mb-2 text-sm font-semibold text-text">{t('booking.partySize')}</Text>
            <View className="mb-5 flex-row flex-wrap">
              {PARTY_SIZES.map((size) => {
                const active = size === partySize;
                return (
                  <Pressable
                    key={size}
                    onPress={() => pickParty(size)}
                    accessibilityState={{ selected: active }}
                    className={`mb-2 mr-2 h-11 w-11 items-center justify-center rounded-full border ${
                      active ? 'border-accent bg-accent' : 'border-border bg-surfaceAlt'
                    } active:opacity-80`}
                  >
                    <Text className={active ? 'font-bold text-accentText' : 'text-text'}>{size}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Date */}
            <Text className="mb-2 text-sm font-semibold text-text">{t('booking.date')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 -mx-1">
              {days.map(({ key, date }) => {
                const active = key === dateKey;
                const label = dateStripLabel(date, locale);
                return (
                  <Pressable
                    key={key}
                    onPress={() => pickDate(key)}
                    accessibilityState={{ selected: active }}
                    className={`mx-1 h-16 w-14 items-center justify-center rounded-xl border ${
                      active ? 'border-accent bg-accent' : 'border-border bg-surfaceAlt'
                    } active:opacity-80`}
                  >
                    <Text className={`text-xs ${active ? 'text-accentText' : 'text-textMuted'}`}>
                      {label.weekday}
                    </Text>
                    <Text className={`text-lg font-bold ${active ? 'text-accentText' : 'text-text'}`}>
                      {label.day}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Time */}
            <Text className="mb-2 text-sm font-semibold text-text">{t('booking.time')}</Text>
            {slots.isPending ? (
              <View className="mb-5 flex-row flex-wrap">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="mb-2 mr-2 h-11 w-20 rounded-xl" />
                ))}
              </View>
            ) : slots.isError ? (
              <View className="mb-5 items-center py-4">
                <Text className="text-sm text-textMuted">{t('error.generic')}</Text>
                <Pressable onPress={() => slots.refetch()} className="mt-2 active:opacity-70">
                  <Text className="font-semibold text-accent">{t('error.retry')}</Text>
                </Pressable>
              </View>
            ) : (slots.data?.slots.length ?? 0) === 0 ? (
              <View className="mb-5 items-center py-6">
                <Ionicons name="calendar-outline" size={28} color={colors.textFaint} />
                <Text className="mt-2 text-sm text-textMuted">{t('booking.noTimes')}</Text>
              </View>
            ) : (
              <View className="mb-5 flex-row flex-wrap">
                {slots.data?.slots.map((slot) => {
                  const active = slot.time === selectedTime;
                  const disabled = !slot.available;
                  return (
                    <Pressable
                      key={slot.time}
                      disabled={disabled}
                      onPress={() => {
                        setSelectedTime(slot.time);
                        setError(null);
                      }}
                      accessibilityState={{ disabled, selected: active }}
                      className={`mb-2 mr-2 rounded-xl border px-4 py-2.5 ${
                        disabled
                          ? 'border-border bg-surfaceAlt opacity-40'
                          : active
                            ? 'border-accent bg-accent'
                            : 'border-border bg-surfaceAlt'
                      } ${disabled ? '' : 'active:opacity-80'}`}
                    >
                      <Text
                        className={
                          disabled
                            ? 'text-textFaint line-through'
                            : active
                              ? 'font-bold text-accentText'
                              : 'text-text'
                        }
                      >
                        {formatTime(slot.time, locale)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Note */}
            <Text className="mb-2 text-sm font-semibold text-text">{t('booking.note')}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('booking.notePlaceholder')}
              placeholderTextColor={colors.textFaint}
              multiline
              className="mb-4 min-h-[64px] rounded-xl bg-surfaceAlt px-4 py-3 text-text"
              style={{ color: colors.text, textAlignVertical: 'top' }}
            />

            {error ? <Text className="mb-3 text-sm text-accent">{error}</Text> : null}

            {/* Confirm */}
            <Pressable
              disabled={!selectedTime || create.isPending}
              onPress={confirm}
              className={`h-12 flex-row items-center justify-center rounded-xl bg-accent active:opacity-80 ${
                !selectedTime || create.isPending ? 'opacity-50' : ''
              }`}
            >
              {create.isPending ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text className="font-semibold text-accentText">{t('booking.confirm')}</Text>
              )}
            </Pressable>

            <Text className="mt-3 text-center text-xs text-textFaint">{t('booking.identityNote')}</Text>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
