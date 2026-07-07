import { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBranchMenu } from '@/api/useBranchMenu';
import { ModifierGroups } from '@/components/menu/ModifierGroups';
import { Skeleton } from '@/components/Skeleton';
import { colors } from '@/theme/theme';

/**
 * Read-only item detail (ORDER-3): image, name, description, modifier groups shown for
 * information only. No selection, no price, no add-to-cart — that arrives in ORDER-4.
 * The item is resolved from the branch-menu cache (no extra fetch).
 */
export default function MenuItemDetailScreen() {
  const { branchId, itemId } = useLocalSearchParams<{ branchId: string; itemId: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');

  const { categories, isPending, isError } = useBranchMenu(branchId);

  const item = useMemo(
    () => categories.flatMap((c) => c.items).find((i) => i.id === itemId),
    [categories, itemId],
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

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Header />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
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

          {item.description ? (
            <Text className="mt-2 leading-6 text-textMuted">{item.description}</Text>
          ) : null}

          <ModifierGroups groups={item.modifierGroups} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
