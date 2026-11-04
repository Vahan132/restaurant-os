import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { CategoryStrip } from '@/components/CategoryStrip';
import { RestaurantCard } from '@/components/RestaurantCard';
import { CardSkeleton } from '@/components/Skeleton';
import { useRestaurantsInfinite } from '@/api/useRestaurantsInfinite';
import { useFiltersStore } from '@/store/filters';
import { useDebounce } from '@/lib/useDebounce';
import { colors } from '@/theme/theme';

/**
 * Discovery list (Home) — the real surface, replacing the CX-APP-0 smoke test.
 * Top bar + category strip are fixed; the card list is infinite-scroll and reacts to the
 * shared filter store (debounced search + selected attribute values).
 */
export default function HomeScreen() {
  const { t } = useTranslation('common');
  const searchQuery = useFiltersStore((s) => s.searchQuery);
  const selectedIds = useFiltersStore((s) => s.selectedAttributeValueIds);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const {
    data,
    isPending,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRestaurantsInfinite(debouncedQuery, selectedIds);

  const items = useMemo(() => data?.pages.flat() ?? [], [data]);

  return (
    <Screen className="px-0">
      <View className="px-5">
        <TopBar />
        <CategoryStrip />
      </View>

      {isPending ? (
        <View className="flex-1 px-5 pt-2">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-5">
          <Text className="mb-4 text-base text-textMuted">{t('error.generic')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => refetch()}
            className="rounded-xl bg-accent px-5 py-3 active:opacity-80"
          >
            <Text className="font-semibold text-accentText">{t('error.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.branchId}
          renderItem={({ item }) => <RestaurantCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={() => refetch()}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center px-6 pt-24">
              <Ionicons name="search-outline" size={40} color={colors.textFaint} />
              <Text className="mt-4 text-lg font-semibold text-text">{t('list.emptyTitle')}</Text>
              <Text className="mt-1 text-center text-sm text-textMuted">{t('list.emptyHint')}</Text>
            </View>
          }
          ListFooterComponent={isFetchingNextPage ? <CardSkeleton /> : <View className="h-2" />}
        />
      )}
    </Screen>
  );
}
