import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/theme';

/** Icon + content row used across the detail Overview tab. Pressable when `onPress` is set. */
export function InfoRow({
  icon,
  children,
  onPress,
  rightIcon,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  onPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const inner = (
    <>
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <View className="ml-3 flex-1">{children}</View>
      {rightIcon ? <Ionicons name={rightIcon} size={18} color={colors.textFaint} /> : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        className="flex-row items-center px-5 py-3 active:opacity-70"
      >
        {inner}
      </Pressable>
    );
  }
  return <View className="flex-row items-center px-5 py-3">{inner}</View>;
}
