import { type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

/**
 * Themed screen wrapper: dark `bg`, SafeArea handling for the notch/home indicator.
 * Default edges exclude the bottom so it sits flush above the tab bar.
 */
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  className = '',
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  className?: string;
}) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-bg">
      <View className={`flex-1 px-5 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
