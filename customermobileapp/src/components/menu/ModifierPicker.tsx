import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { PublicModifierGroupResponse } from '@/api/generated/model';
import { formatPriceDelta } from '@/lib/money';
import { toggleModifierOption, type ModifierSelection } from '@/lib/modifiers';
import { colors } from '@/theme/theme';

/**
 * ModifierPicker (ORDER-4) — the interactive replacement for ORDER-3's read-only
 * ModifierGroups, mounted on the SAME `PublicModifierGroupResponse[]` data. SINGLE
 * groups render as radios, MULTIPLE as checkboxes (capped at `maxSelect`); price deltas
 * are shown. Selection is owned by the parent; this only renders + emits changes.
 */
export function ModifierPicker({
  groups,
  currency,
  selection,
  onChange,
}: {
  groups: PublicModifierGroupResponse[];
  currency: string;
  selection: ModifierSelection;
  onChange: (groupId: string, optionIds: string[]) => void;
}) {
  const { t } = useTranslation('common');
  if (groups.length === 0) return null;

  return (
    <View className="mt-2">
      {groups.map((group) => {
        const selected = selection[group.id] ?? [];
        const single = group.selectionType === 'SINGLE';
        return (
          <View key={group.id} className="mb-5">
            <View className="mb-2 flex-row items-center gap-2">
              <Text className="text-base font-semibold text-text">{group.name}</Text>
              <Text className="text-xs text-textFaint">{ruleLabel(group, t)}</Text>
            </View>
            {group.options.map((opt) => {
              const isSelected = selected.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole={single ? 'radio' : 'checkbox'}
                  accessibilityState={{ selected: isSelected, checked: isSelected }}
                  onPress={() => onChange(group.id, toggleModifierOption(group, selection, opt.id))}
                  className="flex-row items-center py-2 active:opacity-70"
                >
                  <Ionicons
                    name={
                      single
                        ? isSelected
                          ? 'radio-button-on'
                          : 'radio-button-off'
                        : isSelected
                          ? 'checkbox'
                          : 'square-outline'
                    }
                    size={20}
                    color={isSelected ? colors.accent : colors.textFaint}
                  />
                  <Text className="ml-3 flex-1 text-text">{opt.name}</Text>
                  {opt.priceDeltaAmount !== 0 ? (
                    <Text className="text-sm text-textMuted">
                      {formatPriceDelta(opt.priceDeltaAmount, currency)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/** e.g. "Required · Choose 1" / "Optional · Choose up to 2". */
function ruleLabel(
  group: PublicModifierGroupResponse,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const requirement = group.required ? t('menu.required') : t('menu.optional');
  let choice: string | null = null;
  if (group.selectionType === 'SINGLE') {
    choice = t('menu.chooseOne');
  } else if (group.maxSelect != null) {
    choice = t('menu.chooseUpTo', { count: group.maxSelect });
  } else if (group.minSelect != null && group.minSelect > 0) {
    choice = t('menu.chooseAtLeast', { count: group.minSelect });
  }
  return choice ? `${requirement} · ${choice}` : requirement;
}
