import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBranchMenu } from '@/api/useBranchMenu';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { CartBar } from '@/components/order/CartBar';
import { Chip } from '@/components/Chip';
import { Skeleton } from '@/components/Skeleton';
import { useCartStore } from '@/store/cart';
import { colors } from '@/theme/theme';

/**
 * Native branch menu (ORDER-3 browse + ORDER-4 ordering overlay).
 *
 * Read-only by default. When an ORDER-4 ordering session is active for THIS branch
 * (a table was scanned → `useCartStore().context.branchId === branchId`), it mounts the
 * cart affordances additively: prices, a trailing add control per item, and a sticky
 * cart bar. Without an active context it stays exactly the read-only ORDER-3 surface.
 */
export default function BranchMenuScreen() {
  const { branchId } = useLocalSearchParams<{ branchId: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');

  const { detail, menu, categories, isPending, isError, menuUnavailable, refetch } =
    useBranchMenu(branchId);

  // ORDER-4: ordering mode iff a scanned session targets this branch.
  const context = useCartStore((s) => s.context);
  const lines = useCartStore((s) => s.lines);
  const addLine = useCartStore((s) => s.addLine);
  const ordering = context?.branchId === branchId;
  const currency = menu?.currency;

  const qtyInCart = (menuItemId: string) =>
    lines.reduce((n, l) => (l.menuItemId === menuItemId ? n + l.quantity : n), 0);

  const handleAdd = (itemId: string, name: string, priceAmount: number, hasModifiers: boolean) => {
    // Items with modifiers must be configured on the detail screen; simple items add now.
    if (hasModifiers) {
      router.push({ pathname: '/menu/[branchId]/[itemId]', params: { branchId, itemId } });
      return;
    }
    addLine({ menuItemId: itemId, name, unitPriceAmount: priceAmount, modifiers: [], note: null });
  };

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) ?? categories[0],
    [categories, activeCategoryId],
  );

  const Header = () => (
    <View className="flex-row items-center px-4 py-2">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={8}
        className="flex-row items-center active:opacity-70"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
        <Text className="ml-1 text-base text-text" numberOfLines={1}>
          {detail?.name ?? t('menu.title')}
        </Text>
      </Pressable>
    </View>
  );

  if (isPending) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <View className="flex-row px-4 pb-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="mr-2 h-9 w-24 rounded-full" />
          ))}
        </View>
        <View className="px-5">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="mb-3 flex-row gap-3 rounded-2xl bg-surface p-3">
              <View className="flex-1">
                <Skeleton className="mb-2 h-5 w-2/3 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
              </View>
              <Skeleton className="h-20 w-20 rounded-xl" />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <StateBlock
          icon="cloud-offline-outline"
          title={t('menu.errorTitle')}
          hint={t('menu.errorHint')}
          actionLabel={t('error.retry')}
          onAction={refetch}
        />
      </SafeAreaView>
    );
  }

  if (menuUnavailable || categories.length === 0) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <StateBlock
          icon="restaurant-outline"
          title={t('menu.emptyTitle')}
          hint={t('menu.emptyHint')}
          actionLabel={t('detail.back')}
          onAction={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Header />

      {/* Category selector — horizontal chip strip (matches CategoryStrip convention). */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="py-2"
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              selected={cat.id === activeCategory?.id}
              onPress={() => setActiveCategoryId(cat.id)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={activeCategory?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: ordering ? 96 : 32,
        }}
        ListHeaderComponent={
          activeCategory?.description ? (
            <Text className="pb-3 text-sm text-textMuted">{activeCategory.description}</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text className="pt-8 text-center text-textMuted">{t('menu.categoryEmpty')}</Text>
        }
        renderItem={({ item }) => (
          <MenuItemCard
            item={item}
            currency={currency}
            onPress={() =>
              router.push({
                pathname: '/menu/[branchId]/[itemId]',
                params: { branchId, itemId: item.id },
              })
            }
            onAdd={
              ordering
                ? () =>
                    handleAdd(item.id, item.name, item.priceAmount, item.modifierGroups.length > 0)
                : undefined
            }
            quantityInCart={ordering ? qtyInCart(item.id) : 0}
          />
        )}
      />

      {ordering ? (
        <CartBar currency={currency} onPress={() => router.push('/cart' as Href)} />
      ) : null}
    </SafeAreaView>
  );
}

function StateBlock({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Ionicons name={icon} size={44} color={colors.textFaint} />
      <Text className="mt-4 text-lg font-semibold text-text">{title}</Text>
      <Text className="mt-1 text-center text-sm text-textMuted">{hint}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        className="mt-6 rounded-xl border border-border px-5 py-3 active:opacity-80"
      >
        <Text className="font-semibold text-text">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
