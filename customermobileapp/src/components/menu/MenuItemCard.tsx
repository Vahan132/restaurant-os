import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PublicMenuItemResponse } from '@/api/generated/model';
import { colors } from '@/theme/theme';

/**
 * MenuItemCard — a single read-only dish row (name, description, image, availability).
 *
 * ORDER-3 is display-only: tapping opens the item detail, there is NO add control here.
 * Structured so ORDER-4 (app ordering) can mount a quantity/add affordance additively
 * (e.g. a trailing button) without reworking this layout.
 */
export function MenuItemCard({
  item,
  onPress,
}: {
  item: PublicMenuItemResponse;
  onPress: () => void;
}) {
  const { t } = useTranslation('common');
  const unavailable = !item.available;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`mb-3 flex-row items-stretch gap-3 rounded-2xl bg-surface p-3 active:opacity-80 ${
        unavailable ? 'opacity-60' : ''
      }`}
    >
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base font-semibold text-text" numberOfLines={1}>
            {item.name}
          </Text>
          {unavailable ? (
            <View className="shrink-0 rounded-full bg-surfaceAlt px-2 py-0.5">
              <Text className="text-[10px] font-medium uppercase tracking-wide text-textMuted">
                {t('menu.unavailable')}
              </Text>
            </View>
          ) : null}
        </View>
        {item.description ? (
          <Text className="mt-1 text-sm text-textMuted" numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        {item.modifierGroups.length > 0 ? (
          <Text className="mt-2 text-xs text-textFaint">
            {t('menu.optionsAvailable')}
          </Text>
        ) : null}
      </View>

      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          className={`h-20 w-20 shrink-0 rounded-xl bg-surfaceAlt ${
            unavailable ? 'opacity-70' : ''
          }`}
        />
      ) : (
        <View className="h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surfaceAlt">
          <Ionicons name="restaurant-outline" size={22} color={colors.textFaint} />
        </View>
      )}
    </Pressable>
  );
}
