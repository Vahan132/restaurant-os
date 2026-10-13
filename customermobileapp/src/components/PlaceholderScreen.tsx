import { Text, View } from 'react-native';
import { Screen } from './Screen';

/**
 * Minimal themed placeholder for the not-yet-built tabs (Reservations / Saved / Profile).
 * Title only — real content lands in later prompts.
 */
export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <Text className="text-2xl font-semibold text-text">{title}</Text>
        <Text className="mt-2 text-base text-textMuted">Coming soon</Text>
      </View>
    </Screen>
  );
}
