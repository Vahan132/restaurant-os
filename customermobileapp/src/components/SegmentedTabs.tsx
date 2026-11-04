import { Pressable, Text, View } from 'react-native';

export interface SegmentTab<K extends string> {
  key: K;
  label: string;
}

/** Segmented control with an accent underline on the active segment. */
export function SegmentedTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SegmentTab<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <View className="flex-row border-b border-border">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab.key)}
            className="flex-1 items-center py-3"
          >
            <Text className={isActive ? 'font-semibold text-text' : 'text-textMuted'}>
              {tab.label}
            </Text>
            <View
              className={`mt-2 h-0.5 w-12 rounded-full ${isActive ? 'bg-accent' : 'bg-transparent'}`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
