import { Pressable, Text } from 'react-native';

/** Selectable pill. Selected = accent fill; idle = surface with hairline border. */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`mr-2 rounded-full border px-4 py-2 active:opacity-80 ${
        selected ? 'border-accent bg-accent' : 'border-border bg-surface'
      }`}
    >
      <Text className={selected ? 'font-semibold text-accentText' : 'text-text'}>{label}</Text>
    </Pressable>
  );
}
