import { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PhotoResponse } from '@/api/generated/model';
import type { AppLocale } from '@/i18n';
import { pickI18n } from '@/lib/i18n-fields';
import { colors } from '@/theme/theme';

const HEIGHT = 280;

/**
 * Swipeable image carousel for the detail gallery (ordered by `position`).
 * Prev/next arrows + dot indicator; `alt` via pickI18n for a11y. Placeholder when empty.
 */
export function Carousel({ photos, locale }: { photos: PhotoResponse[]; locale: AppLocale }) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<PhotoResponse>>(null);
  const [index, setIndex] = useState(0);

  const ordered = [...photos].sort((a, b) => a.position - b.position);

  if (ordered.length === 0) {
    return (
      <View style={{ height: HEIGHT }} className="w-full items-center justify-center bg-surfaceAlt">
        <Ionicons name="image-outline" size={44} color={colors.textFaint} />
      </View>
    );
  }

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(ordered.length - 1, next));
    listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    setIndex(clamped);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={{ height: HEIGHT }} className="w-full bg-surfaceAlt">
      <FlatList
        ref={listRef}
        data={ordered}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url }}
            accessibilityLabel={pickI18n(item.alt, locale) || undefined}
            style={{ width, height: HEIGHT }}
            resizeMode="cover"
          />
        )}
      />

      {ordered.length > 1 ? (
        <>
          <Pressable
            accessibilityLabel="Previous"
            onPress={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 h-9 w-9 items-center justify-center rounded-full"
            style={{ marginTop: -18, backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityLabel="Next"
            onPress={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 h-9 w-9 items-center justify-center rounded-full"
            style={{ marginTop: -18, backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </Pressable>

          <View className="absolute bottom-3 w-full flex-row items-center justify-center">
            {ordered.map((p, i) => (
              <View
                key={p.id}
                className="mx-1 h-1.5 rounded-full"
                style={{
                  width: i === index ? 18 : 6,
                  backgroundColor: i === index ? colors.accent : 'rgba(255,255,255,0.5)',
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
