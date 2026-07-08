import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBranchMenu } from '@/api/useBranchMenu';
import { ModifierGroups } from '@/components/menu/ModifierGroups';
import { ModifierPicker } from '@/components/menu/ModifierPicker';
import { Skeleton } from '@/components/Skeleton';
import { useCartStore } from '@/store/cart';
import { formatMoney } from '@/lib/money';
import {
  initialSelection,
  isSelectionValid,
  selectedModifiers,
  type ModifierSelection,
} from '@/lib/modifiers';
import { colors } from '@/theme/theme';

/**
 * Item detail (ORDER-3 read-only + ORDER-4 ordering overlay).
 *
 * Read-only by default (image, name, description, read-only ModifierGroups). When an
 * ORDER-4 session targets this branch, it becomes interactive: prices, a ModifierPicker
 * (radios/checkboxes), a quantity stepper, and an "Add to cart" footer. The item is
 * resolved from the branch-menu cache (no extra fetch).
 */
export default function MenuItemDetailScreen() {
  const { branchId, itemId } = useLocalSearchParams<{ branchId: string; itemId: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  const { menu, categories, isPending, isError } = useBranchMenu(branchId);

  const item = useMemo(
    () => categories.flatMap((c) => c.items).find((i) => i.id === itemId),
    [categories, itemId],
  );

  // ORDER-4: ordering mode iff a scanned session targets this branch.
  const context = useCartStore((s) => s.context);
  const addLine = useCartStore((s) => s.addLine);
  const ordering = context?.branchId === branchId;
  const currency = menu?.currency;

  const [selection, setSelection] = useState<ModifierSelection>({});
  const [quantity, setQuantity] = useState(1);

  // Initialize (and reset on item change) the modifier selection with sensible defaults.
  useEffect(() => {
    if (item) {
      setSelection(initialSelection(item.modifierGroups));
      setQuantity(1);
    }
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const Header = () => (
    <View className="flex-row items-center px-4 py-2">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={8}
        className="flex-row items-center active:opacity-70"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
        <Text className="ml-1 text-base text-text">{t('menu.title')}</Text>
      </Pressable>
    </View>
  );

  if (isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <Skeleton className="h-64 w-full" />
        <View className="p-5">
          <Skeleton className="mb-3 h-7 w-2/3 rounded-md" />
          <Skeleton className="mb-2 h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !item) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={44} color={colors.textFaint} />
          <Text className="mt-4 text-lg font-semibold text-text">{t('menu.itemMissingTitle')}</Text>
          <Text className="mt-1 text-center text-sm text-textMuted">{t('menu.itemMissingHint')}</Text>
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

  const unavailable = !item.available;
  // Non-null only in ordering mode with a known currency — narrows `currency` for JSX.
  const orderingCurrency: string | null =
    ordering && !unavailable && currency ? currency : null;

  // Live line price (base + selected deltas) × quantity — display only; server revalidates.
  const selected = selectedModifiers(item.modifierGroups, selection);
  const unitPrice = item.priceAmount + selected.reduce((s, m) => s + m.option.priceDeltaAmount, 0);
  const linePrice = unitPrice * quantity;
  const canAdd = !!orderingCurrency && isSelectionValid(item.modifierGroups, selection);

  const handleAddToCart = () => {
    if (!canAdd) return;
    addLine({
      menuItemId: item.id,
      name: item.name,
      unitPriceAmount: item.priceAmount,
      quantity,
      note: null,
      modifiers: selected.map((m) => ({
        modifierOptionId: m.option.id,
        groupId: m.groupId,
        name: m.option.name,
        priceDeltaAmount: m.option.priceDeltaAmount,
      })),
    });
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Header />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: orderingCurrency ? 128 : 40 }}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} className="h-64 w-full bg-surfaceAlt" />
        ) : (
          <View className="h-48 w-full items-center justify-center bg-surfaceAlt">
            <Ionicons name="restaurant-outline" size={40} color={colors.textFaint} />
          </View>
        )}

        <View className="px-5 pt-4">
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 text-2xl font-bold text-text">{item.name}</Text>
            {unavailable ? (
              <View className="rounded-full bg-surfaceAlt px-3 py-1">
                <Text className="text-xs font-medium uppercase tracking-wide text-textMuted">
                  {t('menu.unavailable')}
                </Text>
              </View>
            ) : null}
          </View>

          {currency ? (
            <Text className="mt-1 text-lg font-semibold text-text">
              {formatMoney(item.priceAmount, currency)}
            </Text>
          ) : null}

          {item.description ? (
            <Text className="mt-2 leading-6 text-textMuted">{item.description}</Text>
          ) : null}

          {/* Interactive picker in ordering mode; read-only groups otherwise. */}
          {orderingCurrency ? (
            <ModifierPicker
              groups={item.modifierGroups}
              currency={orderingCurrency}
              selection={selection}
              onChange={(groupId, ids) => setSelection((s) => ({ ...s, [groupId]: ids }))}
            />
          ) : (
            <ModifierGroups groups={item.modifierGroups} />
          )}
        </View>
      </ScrollView>

      {/* ORDER-4: quantity stepper + Add-to-cart footer. */}
      {orderingCurrency ? (
        <View
          className="absolute inset-x-0 bottom-0 flex-row items-center gap-3 border-t border-border bg-bg px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-row items-center rounded-xl border border-border">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('order.decrease')}
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              hitSlop={6}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <Ionicons name="remove" size={20} color={colors.text} />
            </Pressable>
            <Text className="w-8 text-center text-base font-semibold text-text">{quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('order.increase')}
              onPress={() => setQuantity((q) => q + 1)}
              hitSlop={6}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <Ionicons name="add" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canAdd}
            onPress={handleAddToCart}
            className={`h-12 flex-1 flex-row items-center justify-between rounded-xl px-4 ${
              canAdd ? 'bg-accent active:opacity-80' : 'bg-surfaceAlt'
            }`}
          >
            <Text className={`font-semibold ${canAdd ? 'text-accentText' : 'text-textFaint'}`}>
              {t('order.add')}
            </Text>
            <Text className={`font-bold ${canAdd ? 'text-accentText' : 'text-textFaint'}`}>
              {formatMoney(linePrice, orderingCurrency)}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
