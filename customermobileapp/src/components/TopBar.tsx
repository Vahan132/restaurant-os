import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFiltersStore } from '@/store/filters';
import { useRequireAuth } from '@/lib/auth-gate';
import { useLocale } from '@/i18n/useLocale';
import type { AppLocale } from '@/i18n';
import { colors } from '@/theme/theme';

const LOCALE_LABELS: Record<AppLocale, string> = { hy: 'Հայերեն', ru: 'Русский', en: 'English' };

/**
 * Discovery top bar: filter (sliders) icon → Filters sheet, debounced search input
 * (drives the shared store's `searchQuery`), and an overflow menu (language + login stub).
 */
export function TopBar() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const requireAuth = useRequireAuth();
  const { locale, setLocale, supported } = useLocale();
  const searchQuery = useFiltersStore((s) => s.searchQuery);
  const setSearchQuery = useFiltersStore((s) => s.setSearchQuery);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View className="flex-row items-center px-1 py-2">
      {/* Filters */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('filters.title')}
        onPress={() => router.push('/filters')}
        className="mr-2 h-11 w-11 items-center justify-center rounded-xl bg-surface active:opacity-80"
      >
        <Ionicons name="options-outline" size={22} color={colors.text} />
      </Pressable>

      {/* Search */}
      <View className="h-11 flex-1 flex-row items-center rounded-xl bg-surface px-3">
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textFaint}
          returnKeyType="search"
          className="ml-2 h-11 flex-1 text-text"
          style={{ color: colors.text }}
        />
        {searchQuery.length > 0 ? (
          <Pressable accessibilityLabel="Clear" hitSlop={8} onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {/* Overflow */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More"
        onPress={() => setMenuOpen(true)}
        className="ml-2 h-11 w-11 items-center justify-center rounded-xl bg-surface active:opacity-80"
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
      </Pressable>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1" onPress={() => setMenuOpen(false)}>
          <View className="absolute right-3 top-24 w-56 rounded-2xl border border-border bg-surfaceAlt p-2">
            <Text className="px-3 py-2 text-xs uppercase text-textFaint">{t('overflow.language')}</Text>
            {supported.map((l) => (
              <Pressable
                key={l}
                onPress={() => {
                  setLocale(l);
                  setMenuOpen(false);
                }}
                className="flex-row items-center justify-between rounded-xl px-3 py-2 active:bg-surface"
              >
                <Text className="text-text">{LOCALE_LABELS[l]}</Text>
                {l === locale ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
              </Pressable>
            ))}
            <View className="my-1 h-px bg-border" />
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                requireAuth();
              }}
              className="rounded-xl px-3 py-2 active:bg-surface"
            >
              <Text className="text-text">{t('overflow.login')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
