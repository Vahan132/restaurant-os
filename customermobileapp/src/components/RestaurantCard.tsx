import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ConsumerBranchCardResponse } from '@/api/generated/model';
import { useRequireAuth } from '@/lib/auth-gate';
import { useSaveControl } from '@/lib/use-save-control';
import { colors } from '@/theme/theme';

/**
 * Restaurant card for the discovery list (reused by the Saved tab).
 * - Whole card → detail route.
 * - "Book a table" shown only when `reservationsPublic` → requireAuth → booking sheet.
 * - Bookmark reflects saved state and toggles save/unsave (gated when anonymous).
 */
export function RestaurantCard({ item }: { item: ConsumerBranchCardResponse }) {
  const router = useRouter();
  const { t } = useTranslation('common');
  const requireAuth = useRequireAuth();
  const { isSaved, toggle } = useSaveControl(item);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/restaurant/[branchId]', params: { branchId: item.branchId } })
      }
      className="mb-4 overflow-hidden rounded-2xl bg-surface active:opacity-90"
    >
      {/* Hero */}
      {item.heroPhotoUrl ? (
        <Image source={{ uri: item.heroPhotoUrl }} className="h-44 w-full" resizeMode="cover" />
      ) : (
        <View className="h-44 w-full items-center justify-center bg-surfaceAlt">
          <Ionicons name="restaurant-outline" size={36} color={colors.textFaint} />
        </View>
      )}

      <View className="p-4">
        {/* Brand row */}
        <View className="flex-row items-center">
          {item.logoUrl ? (
            <Image
              source={{ uri: item.logoUrl }}
              className="mr-3 h-9 w-9 rounded-full bg-surfaceAlt"
            />
          ) : (
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-surfaceAlt">
              <Ionicons name="storefront-outline" size={18} color={colors.textFaint} />
            </View>
          )}
          <Text className="flex-1 text-lg font-semibold text-text" numberOfLines={1}>
            {item.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSaved ? t('saved.unsave') : t('saved.save')}
            hitSlop={10}
            onPress={toggle}
            className="ml-2 p-1 active:opacity-70"
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isSaved ? colors.accent : colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Address */}
        {item.address ? (
          <View className="mt-2 flex-row items-center">
            <Ionicons name="location-outline" size={16} color={colors.textFaint} />
            <Text className="ml-1 flex-1 text-sm text-textMuted" numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        ) : null}

        {/* Book a table — only when reservations are public */}
        {item.reservationsPublic ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => requireAuth({ type: 'book', branchId: item.branchId })}
            className="mt-3 self-start rounded-xl border border-accent px-4 py-2 active:opacity-80"
          >
            <Text className="font-semibold text-accent">{t('card.book')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
