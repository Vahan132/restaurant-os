import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cartCount, cartSubtotal, useCartStore } from '@/store/cart';
import { formatMoney } from '@/lib/money';

/**
 * CartBar (ORDER-4) — sticky bottom summary shown while a cart has items. Mounts
 * additively over the menu surfaces; renders nothing when there's no active ordering
 * context or the cart is empty (so discovery/read-only browse never shows it).
 */
export function CartBar({ currency, onPress }: { currency?: string; onPress: () => void }) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const context = useCartStore((s) => s.context);
  const lines = useCartStore((s) => s.lines);

  const count = cartCount(lines);
  if (!context || count === 0) return null;
  const subtotal = cartSubtotal(lines);

  return (
    <View
      className="absolute inset-x-0 bottom-0 px-4"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="h-14 flex-row items-center justify-between rounded-2xl bg-accent px-4 active:opacity-90"
      >
        <View className="flex-row items-center gap-2">
          <View className="min-w-6 items-center rounded-full bg-accentText/20 px-2 py-0.5">
            <Text className="text-sm font-bold text-accentText">{count}</Text>
          </View>
          <Text className="font-semibold text-accentText">{t('order.viewCart')}</Text>
        </View>
        {currency ? (
          <Text className="font-bold text-accentText">{formatMoney(subtotal, currency)}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}
