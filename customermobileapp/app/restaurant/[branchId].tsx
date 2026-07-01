import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePublicDiscoveryControllerDetail } from '@/api/generated/discovery/discovery';
import { Carousel } from '@/components/Carousel';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { InfoRow } from '@/components/InfoRow';
import { Skeleton } from '@/components/Skeleton';
import { useLocale } from '@/i18n/useLocale';
import { pickI18n, pickLabel } from '@/lib/i18n-fields';
import { todayHours } from '@/lib/hours';
import { formatRange, orderedWeek, todaySpecDay } from '@/lib/format-hours';
import { openPhone, openWeb } from '@/lib/links';
import { useRequireAuth } from '@/lib/auth-gate';
import { useSaveControl } from '@/lib/use-save-control';
import { colors } from '@/theme/theme';

type Tab = 'overview' | 'about' | 'features';

export default function RestaurantDetailScreen() {
  const { branchId } = useLocalSearchParams<{ branchId: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const requireAuth = useRequireAuth();

  const { data, isPending, isError } = usePublicDiscoveryControllerDetail(branchId);
  const save = useSaveControl({
    branchId,
    restaurantId: data?.restaurantId,
    name: data?.name,
    logoUrl: data?.logoUrl,
    address: data?.address,
    city: data?.city,
    menuPublic: data?.menuPublic,
    reservationsPublic: data?.reservationsPublic,
  });
  const [tab, setTab] = useState<Tab>('overview');
  const [hoursExpanded, setHoursExpanded] = useState(false);

  // Header bar (back "All restaurants" + logo) is shared across all states.
  const Header = ({ logoUrl, name }: { logoUrl?: string | null; name?: string }) => (
    <View className="flex-row items-center justify-between px-4 py-2">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={8}
        className="flex-row items-center active:opacity-70"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
        <Text className="ml-1 text-base text-text">{t('detail.allRestaurants')}</Text>
      </Pressable>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} className="h-9 w-9 rounded-full bg-surfaceAlt" />
      ) : name ? (
        <View className="h-9 w-9 items-center justify-center rounded-full bg-surfaceAlt">
          <Ionicons name="storefront-outline" size={18} color={colors.textFaint} />
        </View>
      ) : null}
    </View>
  );

  if (isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <Skeleton className="h-64 w-full" />
        <View className="p-5">
          <Skeleton className="mb-3 h-7 w-2/3 rounded-md" />
          <Skeleton className="mb-2 h-4 w-1/2 rounded-md" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={44} color={colors.textFaint} />
          <Text className="mt-4 text-lg font-semibold text-text">
            {t('detail.unavailableTitle')}
          </Text>
          <Text className="mt-1 text-center text-sm text-textMuted">
            {t('detail.unavailableHint')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            className="mt-6 rounded-xl border border-border px-5 py-3 active:opacity-80"
          >
            <Text className="font-semibold text-text">{t('detail.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const aboutText = pickI18n(data.about, locale);
  const todayRow = todayHours(data.weeklyHours);
  const todayRange = formatRange(todayRow);
  const week = orderedWeek(data.weeklyHours);
  const specToday = todaySpecDay();
  const weekdays = t('weekdays', { returnObjects: true }) as unknown as string[];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Header logoUrl={data.logoUrl} name={data.name} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 96 }}>
        <Carousel photos={data.gallery} locale={locale} />

        <Text className="px-5 pb-2 pt-4 text-2xl font-bold text-text">{data.name}</Text>

        <SegmentedTabs<Tab>
          tabs={[
            { key: 'overview', label: t('detail.tabs.overview') },
            { key: 'about', label: t('detail.tabs.about') },
            { key: 'features', label: t('detail.tabs.features') },
          ]}
          active={tab}
          onChange={setTab}
        />

        {/* OVERVIEW */}
        {tab === 'overview' ? (
          <View className="pt-1">
            {data.address ? (
              <InfoRow icon="location-outline">
                <Text className="text-text">{data.address}</Text>
              </InfoRow>
            ) : null}

            {data.publicPhone ? (
              <InfoRow icon="call-outline" onPress={() => openPhone(data.publicPhone)}>
                <Text className="text-text">{data.publicPhone}</Text>
              </InfoRow>
            ) : null}

            {data.website ? (
              <InfoRow icon="globe-outline" onPress={() => openWeb(data.website)}>
                <Text className="text-text" numberOfLines={1}>
                  {data.website}
                </Text>
              </InfoRow>
            ) : null}

            {/* Hours: today derived from weeklyHours, expandable to the full week */}
            <InfoRow
              icon="time-outline"
              onPress={() => setHoursExpanded((v) => !v)}
              rightIcon={hoursExpanded ? 'chevron-up' : 'chevron-down'}
            >
              <Text className="text-text">
                {t('detail.today')}{' '}
                <Text className="text-textMuted">{todayRange ?? t('detail.closed')}</Text>
              </Text>
            </InfoRow>

            {hoursExpanded ? (
              <View className="px-5 pb-2">
                {week.map((row) => {
                  const range = formatRange(row);
                  const isToday = row.dayOfWeek === specToday;
                  return (
                    <View key={row.dayOfWeek} className="flex-row justify-between py-1.5">
                      <Text className={isToday ? 'font-semibold text-text' : 'text-textMuted'}>
                        {weekdays[row.dayOfWeek] ?? ''}
                      </Text>
                      <Text className={isToday ? 'font-semibold text-text' : 'text-textMuted'}>
                        {range ?? t('detail.closed')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* About preview */}
            {aboutText ? (
              <View className="px-5 py-4">
                <Text className="text-textMuted" numberOfLines={3}>
                  {aboutText}
                </Text>
                <Pressable onPress={() => setTab('about')} className="mt-1 active:opacity-70">
                  <Text className="font-semibold text-accent">{t('detail.readMore')}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* View Menu — only when menu is public */}
            {data.menuPublic && data.menuUrl ? (
              <View className="px-5 pb-2">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openWeb(data.menuUrl)}
                  className="flex-row items-center justify-center rounded-xl bg-surface py-3 active:opacity-80"
                >
                  <Ionicons name="restaurant-outline" size={18} color={colors.text} />
                  <Text className="ml-2 font-semibold text-text">{t('detail.viewMenu')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => openWeb(data.menuUrl)}
                  className="mt-2 items-center active:opacity-70"
                >
                  <Text className="text-sm text-accent">{t('detail.openMenuLink')}</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Features preview */}
            {data.features.length > 0 ? (
              <View className="px-5 py-3">
                {data.features.slice(0, 2).map((g) => (
                  <Text key={g.categorySlug} className="mb-1 text-text">
                    {pickLabel(g, locale)}:{' '}
                    <Text className="text-textMuted">
                      {g.values.map((v) => pickLabel(v, locale)).join(', ')}
                    </Text>
                  </Text>
                ))}
                <Pressable onPress={() => setTab('features')} className="mt-1 active:opacity-70">
                  <Text className="font-semibold text-accent">{t('detail.seeAll')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ABOUT */}
        {tab === 'about' ? (
          <View className="px-5 py-4">
            {aboutText ? (
              <Text className="leading-6 text-text">{aboutText}</Text>
            ) : (
              <Text className="text-textMuted">{t('detail.noDescription')}</Text>
            )}
          </View>
        ) : null}

        {/* FEATURES */}
        {tab === 'features' ? (
          <View className="px-5 py-4">
            {data.features.length === 0 ? (
              <Text className="text-textMuted">{t('detail.noDescription')}</Text>
            ) : (
              data.features.map((g) => (
                <View key={g.categorySlug} className="mb-5">
                  <Text className="mb-2 text-base font-semibold text-text">
                    {pickLabel(g, locale)}
                  </Text>
                  {g.values.map((v) => (
                    <View key={v.slug} className="mb-1 flex-row items-center">
                      <View className="mr-2 h-1.5 w-1.5 rounded-full bg-accent" />
                      <Text className="text-textMuted">{pickLabel(v, locale)}</Text>
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky footer */}
      <View className="absolute bottom-0 w-full flex-row items-center gap-3 border-t border-border bg-bg px-5 pb-7 pt-3">
        {data.reservationsPublic ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => requireAuth({ type: 'book', branchId: data.branchId })}
            className="flex-1 items-center rounded-xl bg-accent py-3.5 active:opacity-80"
          >
            <Text className="font-semibold text-accentText">{t('card.book')}</Text>
          </Pressable>
        ) : (
          <View className="flex-1" />
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={save.isSaved ? t('saved.unsave') : t('saved.save')}
          onPress={save.toggle}
          className={`h-12 w-12 items-center justify-center rounded-xl border active:opacity-80 ${
            save.isSaved ? 'border-accent bg-surface' : 'border-border'
          }`}
        >
          <Ionicons
            name={save.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={save.isSaved ? colors.accent : colors.text}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
