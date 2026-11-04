import { ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { usePublicDiscoveryControllerAttributes } from '@/api/generated/discovery/discovery';
import { useFiltersStore } from '@/store/filters';
import { useLocale } from '@/i18n/useLocale';
import { pickLabel } from '@/lib/i18n-fields';
import { Chip } from './Chip';

/**
 * Horizontal strip of filterable category chips (taxonomy hook, ordered by `position`).
 * A chip with any selected value inside it gets the accent treatment. Tapping a chip
 * opens the Filters sheet expanded to that category — selections live in the shared store.
 */
export function CategoryStrip() {
  const router = useRouter();
  const { locale } = useLocale();
  const { data } = usePublicDiscoveryControllerAttributes();
  // Subscribe to the selected ids so chip accent stays in sync as selections change.
  const selectedIds = useFiltersStore((s) => s.selectedAttributeValueIds);
  const setPendingExpandCategory = useFiltersStore((s) => s.setPendingExpandCategory);

  if (!data) return null;

  const categories = data
    .filter((c) => c.isFilterable)
    .sort((a, b) => a.position - b.position);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="py-2"
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      {categories.map((cat) => {
        const selected = cat.values.some((v) => selectedIds.includes(v.id));
        return (
          <Chip
            key={cat.id}
            label={pickLabel(cat, locale)}
            selected={selected}
            onPress={() => {
              setPendingExpandCategory(cat.id);
              router.push('/filters');
            }}
          />
        );
      })}
    </ScrollView>
  );
}
