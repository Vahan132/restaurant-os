import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  useCancelReservation,
  invalidateReservations,
  ConsumerBookingControllerListScope,
  type ConsumerReservationResponse,
} from '@/api/booking';
import { useReservationsInfinite } from '@/api/useReservationsInfinite';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { SignInPrompt } from '@/components/SignInPrompt';
import { CardSkeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/store/auth';
import { useLocale } from '@/i18n/useLocale';
import { formatDateTime } from '@/lib/datetime';
import { isApiError, apiErrorMessage } from '@/lib/api-error';
import { colors } from '@/theme/theme';

type Scope = ConsumerBookingControllerListScope;

/** Statuses a guest can self-cancel from the upcoming list. */
const CANCELLABLE = new Set(['PENDING', 'CONFIRMED']);

export default function ReservationsScreen() {
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const status = useAuthStore((s) => s.status);
  const [scope, setScope] = useState<Scope>(ConsumerBookingControllerListScope.upcoming);

  const query = useReservationsInfinite(scope);
  const cancel = useCancelReservation();
  const items = query.data?.pages.flat() ?? [];

  function confirmCancel(id: string) {
    Alert.alert(t('reservations.cancelTitle'), t('reservations.cancelConfirm'), [
      { text: t('reservations.keep'), style: 'cancel' },
      {
        text: t('reservations.cancelAction'),
        style: 'destructive',
        onPress: () =>
          cancel.mutate(
            { id },
            {
              onSuccess: () => invalidateReservations(),
              onError: (e) => {
                const code = isApiError(e) ? e.code : '';
                Alert.alert(
                  code === 'RESERVATION_NOT_CANCELLABLE'
                    ? t('apiErrors.RESERVATION_NOT_CANCELLABLE')
                    : apiErrorMessage(e, t),
                );
                invalidateReservations();
              },
            },
          ),
      },
    ]);
  }

  const Header = (
    <View>
      <Text className="px-5 pb-3 pt-2 text-2xl font-bold text-text">
        {t('screens.reservationsTitle')}
      </Text>
      <SegmentedTabs<Scope>
        tabs={[
          { key: ConsumerBookingControllerListScope.upcoming, label: t('reservations.upcoming') },
          { key: ConsumerBookingControllerListScope.past, label: t('reservations.past') },
        ]}
        active={scope}
        onChange={setScope}
      />
    </View>
  );

  if (status !== 'authed') {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        {Header}
        <SignInPrompt message={t('reservations.signInPrompt')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <FlatList
        data={items}
        keyExtractor={(item) => item.reservationId}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <ReservationItem
            item={item}
            locale={locale}
            cancellable={scope === ConsumerBookingControllerListScope.upcoming && CANCELLABLE.has(item.status)}
            cancelling={cancel.isPending}
            onCancel={() => confirmCancel(item.reservationId)}
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
        }}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator className="py-4" color={colors.accent} />
          ) : null
        }
        ListEmptyComponent={
          query.isPending ? (
            <View className="pt-3">
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : query.isError ? (
            <View className="items-center pt-16">
              <Text className="text-textMuted">{t('error.generic')}</Text>
              <Pressable onPress={() => query.refetch()} className="mt-3 active:opacity-70">
                <Text className="font-semibold text-accent">{t('error.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center pt-16">
              <Ionicons name="calendar-outline" size={40} color={colors.textFaint} />
              <Text className="mt-4 text-textMuted">
                {scope === ConsumerBookingControllerListScope.upcoming
                  ? t('reservations.emptyUpcoming')
                  : t('reservations.emptyPast')}
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function ReservationItem({
  item,
  locale,
  cancellable,
  cancelling,
  onCancel,
}: {
  item: ConsumerReservationResponse;
  locale: ReturnType<typeof useLocale>['locale'];
  cancellable: boolean;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const { t } = useTranslation('common');
  const name = item.branch?.name ?? t('reservations.unknownVenue');
  const address = item.branch?.address;
  const logoUrl = item.branch?.logoUrl;

  return (
    <View className="mb-4 rounded-2xl bg-surface p-4">
      <View className="flex-row items-center">
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} className="mr-3 h-10 w-10 rounded-full bg-surfaceAlt" />
        ) : (
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surfaceAlt">
            <Ionicons name="storefront-outline" size={18} color={colors.textFaint} />
          </View>
        )}
        <Text className="flex-1 text-base font-semibold text-text" numberOfLines={1}>
          {name}
        </Text>
        <View className="ml-2 rounded-full bg-surfaceAlt px-3 py-1">
          <Text className="text-xs font-semibold text-textMuted">
            {t(`reservationStatus.${item.status}`, { defaultValue: item.status })}
          </Text>
        </View>
      </View>

      {address ? (
        <View className="mt-2 flex-row items-center">
          <Ionicons name="location-outline" size={15} color={colors.textFaint} />
          <Text className="ml-1 flex-1 text-sm text-textMuted" numberOfLines={1}>
            {address}
          </Text>
        </View>
      ) : null}

      <View className="mt-2 flex-row items-center">
        <Ionicons name="time-outline" size={15} color={colors.textFaint} />
        <Text className="ml-1 text-sm text-text">{formatDateTime(item.reservedAt, locale)}</Text>
        <Text className="ml-3 text-sm text-textMuted">
          {t('reservations.guests', { n: item.guestCount })}
        </Text>
      </View>

      {item.note ? (
        <Text className="mt-2 text-sm italic text-textMuted" numberOfLines={2}>
          “{item.note}”
        </Text>
      ) : null}

      {cancellable ? (
        <Pressable
          disabled={cancelling}
          onPress={onCancel}
          className="mt-3 self-start rounded-xl border border-border px-4 py-2 active:opacity-80"
        >
          <Text className="font-semibold text-accent">{t('reservations.cancel')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
