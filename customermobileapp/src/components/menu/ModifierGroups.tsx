import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PublicModifierGroupResponse } from '@/api/generated/model';

/**
 * ModifierGroups — read-only presentation of an item's modifier groups + options.
 *
 * ORDER-3 shows these for information only: no selection state, no radios/checkboxes,
 * no price deltas (there is no cart yet, and prices must not be actionable). ORDER-4
 * (app ordering) will replace this with an interactive picker mounted on the same data.
 */
export function ModifierGroups({ groups }: { groups: PublicModifierGroupResponse[] }) {
  const { t } = useTranslation('common');
  if (groups.length === 0) return null;

  return (
    <View className="mt-2">
      {groups.map((group) => (
        <View key={group.id} className="mb-5">
          <View className="mb-2 flex-row items-center gap-2">
            <Text className="text-base font-semibold text-text">{group.name}</Text>
            <Text className="text-xs text-textFaint">{ruleLabel(group, t)}</Text>
          </View>
          {group.options.map((opt) => (
            <View key={opt.id} className="flex-row items-center py-1.5">
              <View className="mr-2 h-1.5 w-1.5 rounded-full bg-border" />
              <Text className="text-textMuted">{opt.name}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** e.g. "Required · Choose 1" / "Optional · Choose up to 2". Read-only hint. */
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
