import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePublicDiscoveryControllerAttributes } from '@/api/generated/discovery/discovery';
import type { AttributeCategoryResponse } from '@/api/generated/model';
import { useFiltersStore } from '@/store/filters';
import { useLocale } from '@/i18n/useLocale';
import { pickLabel } from '@/lib/i18n-fields';
import { colors } from '@/theme/theme';

/**
 * Filters sheet (modal route). Data-driven: every `isFilterable` category (ordered by
 * position) renders as a collapsible multi-select chip group. Reads/writes the SAME
 * store as the category strip, so the two can never disagree. Opening from a strip chip
 * (via `pendingExpandCategoryId`) auto-expands and scrolls to that category.
 */
export default function FiltersSheet() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { locale } = useLocale();
  const { data } = usePublicDiscoveryControllerAttributes();

  const selectedIds = useFiltersStore((s) => s.selectedAttributeValueIds);
  const toggleValue = useFiltersStore((s) => s.toggleValue);
  const clearSelected = useFiltersStore((s) => s.clearSelected);
  const pendingExpand = useFiltersStore((s) => s.pendingExpandCategoryId);
  const setPendingExpand = useFiltersStore((s) => s.setPendingExpandCategory);

  const categories: AttributeCategoryResponse[] = (data ?? [])
    .filter((c) => c.isFilterable)
    .sort((a, b) => a.position - b.position);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});

  // Consume the one-shot "open to this category" hint.
  useEffect(() => {
    if (pendingExpand) {
      setExpanded((e) => ({ ...e, [pendingExpand]: true }));
      const id = pendingExpand;
      setPendingExpand(null);
      // Scroll after layout settles.
      const timer = setTimeout(() => {
        const y = offsets.current[id];
        if (typeof y === 'number') scrollRef.current?.scrollTo({ y, animated: true });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pendingExpand, setPendingExpand]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
        <Text className="text-xl font-bold text-text">{t('filters.title')}</Text>
        <Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} className="flex-1" contentContainerStyle={{ paddingBottom: 16 }}>
        {categories.map((cat) => {
          const isOpen = expanded[cat.id] ?? false;
          const selectedInCat = cat.values.filter((v) => selectedIds.includes(v.id)).length;
          return (
            <View
              key={cat.id}
              onLayout={(e) => {
                offsets.current[cat.id] = e.nativeEvent.layout.y;
              }}
              className="border-b border-border"
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setExpanded((s) => ({ ...s, [cat.id]: !isOpen }))}
                className="flex-row items-center justify-between px-5 py-4 active:opacity-80"
              >
                <View className="flex-row items-center">
                  <Text className="text-base font-semibold text-text">{pickLabel(cat, locale)}</Text>
                  {selectedInCat > 0 ? (
                    <View className="ml-2 rounded-full bg-accent px-2 py-0.5">
                      <Text className="text-xs font-semibold text-accentText">{selectedInCat}</Text>
                    </View>
                  ) : null}
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {isOpen ? (
                <View className="flex-row flex-wrap px-5 pb-4">
                  {cat.values
                    .slice()
                    .sort((a, b) => a.position - b.position)
                    .map((v) => {
                      const sel = selectedIds.includes(v.id);
                      return (
                        <Pressable
                          key={v.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: sel }}
                          onPress={() => toggleValue(v.id)}
                          className={`mb-2 mr-2 rounded-full border px-4 py-2 active:opacity-80 ${
                            sel ? 'border-accent bg-accent' : 'border-border bg-surface'
                          }`}
                        >
                          <Text className={sel ? 'font-semibold text-accentText' : 'text-text'}>
                            {pickLabel(v, locale)}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View className="flex-row items-center gap-3 border-t border-border px-5 py-3">
        <Pressable
          accessibilityRole="button"
          onPress={() => clearSelected()}
          className="flex-1 items-center rounded-xl border border-border py-3 active:opacity-80"
        >
          <Text className="font-semibold text-text">{t('filters.reset')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          className="flex-1 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80"
        >
          <Text className="font-semibold text-accentText">{t('filters.apply')}</Text>
          {selectedIds.length > 0 ? (
            <View
              className="ml-2 rounded-full px-2 py-0.5"
              style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}
            >
              <Text className="text-xs font-semibold text-accentText">{selectedIds.length}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
