import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PublicMenuItemResponse } from '@/api/generated/model';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme/theme';

/**
 * MenuItemCard — a single dish row (name, description, image, availability).
 *
 * ORDER-3 was display-only. ORDER-4 mounts two affordances ADDITIVELY, both optional so
 * the read-only browse is unchanged when they're absent:
 *   - `currency` → render the price (ORDER-4 added currency to the menu response).
 *   - `onAdd`    → show a trailing add control (ordering mode only); `quantityInCart`
 *                  badges how many of this item are already in the cart.
 */
export function MenuItemCard({
  item,
  onPress,
  currency,
  onAdd,
  quantityInCart = 0,
}: {
  item: PublicMenuItemResponse;
  onPress: () => void;
  currency?: string;
  onAdd?: () => void;
  quantityInCart?: number;
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
          <Text className="mt-2 text-xs text-textFaint">{t('menu.optionsAvailable')}</Text>
        ) : null}
        {currency ? (
          <Text className="mt-2 text-sm font-semibold text-text">
            {formatMoney(item.priceAmount, currency)}
          </Text>
        ) : null}
      </View>

      <View className="shrink-0 justify-between">
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            className={`h-20 w-20 rounded-xl bg-surfaceAlt ${unavailable ? 'opacity-70' : ''}`}
          />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-xl bg-surfaceAlt">
            <Ionicons name="restaurant-outline" size={22} color={colors.textFaint} />
          </View>
        )}

        {/* ORDER-4: trailing add control, ordering mode only, hidden when unavailable. */}
        {onAdd && !unavailable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('order.add')}
            onPress={onAdd}
            hitSlop={8}
            className="absolute -bottom-1 -right-1 h-8 min-w-8 flex-row items-center justify-center rounded-full bg-accent px-2 active:opacity-80"
          >
            {quantityInCart > 0 ? (
              <Text className="text-sm font-bold text-accentText">{quantityInCart}</Text>
            ) : (
              <Ionicons name="add" size={18} color={colors.accentText} />
            )}
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
