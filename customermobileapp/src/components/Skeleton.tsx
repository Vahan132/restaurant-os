import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

/** A single pulsing placeholder block. `className` sets size/shape (NativeWind). */
export function Skeleton({ className = '' }: { className?: string }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={{ opacity }} className={`bg-surfaceAlt ${className}`} />;
}

/** Card-shaped skeleton matching the restaurant card footprint. */
export function CardSkeleton() {
  return (
    <View className="mb-4 overflow-hidden rounded-2xl bg-surface">
      <Skeleton className="h-44 w-full" />
      <View className="p-4">
        <Skeleton className="mb-2 h-5 w-2/3 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
      </View>
    </View>
  );
}
