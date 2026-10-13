import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ConsumerBranchCardResponse } from '@/api/generated/model';
import { useSavedList, performUnsave, type SavedRestaurantCardResponse } from '@/api/saved';
import { RestaurantCard } from '@/components/RestaurantCard';
import { SignInPrompt } from '@/components/SignInPrompt';
import { CardSkeleton } from '@/components/Skeleton';
import { useAuthStore } from '@/store/auth';
import { colors } from '@/theme/theme';

/** Adapt a saved-card payload to the discovery card shape (listed branches only). */
function toBranchCard(s: SavedRestaurantCardResponse): ConsumerBranchCardResponse {
  return {
    branchId: s.branchId,
    restaurantId: s.restaurantId ?? '',
    name: s.name ?? '',
    logoUrl: s.logoUrl,
    heroPhotoUrl: s.heroPhotoUrl,
    address: s.address,
    city: s.city,
    menuPublic: s.menuPublic ?? false,
    reservationsPublic: s.reservationsPublic ?? false,
    attributes: s.attributes,
  };
}

export default function SavedScreen() {
  const { t } = useTranslation('common');
  const status = useAuthStore((s) => s.status);
  const query = useSavedList();
  const items = query.data ?? [];

  const Header = (
    <Text className="px-5 pb-3 pt-2 text-2xl font-bold text-text">{t('screens.savedTitle')}</Text>
  );

  if (status !== 'authed') {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        {Header}
        <SignInPrompt message={t('saved.signInPrompt')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <FlatList
        data={items}
        keyExtractor={(item) => item.branchId}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        renderItem={({ item }) =>
          item.listed ? (
            <RestaurantCard item={toBranchCard(item)} />
          ) : (
            <UnlistedCard item={item} onUnsave={() => confirmUnsave(item.branchId, t)} />
          )
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
              <Ionicons name="bookmark-outline" size={40} color={colors.textFaint} />
              <Text className="mt-4 text-center text-textMuted">{t('saved.empty')}</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function confirmUnsave(branchId: string, t: TFunction) {
  performUnsave(branchId).catch(() => Alert.alert(t('error.generic')));
}

/**
 * A saved branch that has since been unlisted: dimmed, non-navigable, with an
 * "unavailable" note — but still unsaveable.
 */
function UnlistedCard({
  item,
  onUnsave,
}: {
  item: SavedRestaurantCardResponse;
  onUnsave: () => void;
}) {
  const { t } = useTranslation('common');
  return (
    <View className="mb-4 overflow-hidden rounded-2xl bg-surface opacity-60">
      <View className="p-4">
        <View className="flex-row items-center">
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-surfaceAlt">
            <Ionicons name="storefront-outline" size={18} color={colors.textFaint} />
          </View>
          <Text className="flex-1 text-lg font-semibold text-textMuted" numberOfLines={1}>
            {item.name ?? t('saved.unavailableVenue')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('saved.unsave')}
            hitSlop={10}
            onPress={onUnsave}
            className="ml-2 p-1 active:opacity-70"
          >
            <Ionicons name="bookmark" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <View className="mt-2 flex-row items-center">
          <Ionicons name="alert-circle-outline" size={16} color={colors.textFaint} />
          <Text className="ml-1 flex-1 text-sm text-textFaint">{t('saved.unavailableNote')}</Text>
        </View>
      </View>
    </View>
  );
}
