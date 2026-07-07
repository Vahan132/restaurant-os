import '../global.css';
import '@/i18n'; // side-effect: initialize i18next before any screen renders

import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/api/query-client';
import { useAuthStore } from '@/store/auth';
import { hydrateSession } from '@/auth/session';
import { colors } from '@/theme/theme';

/**
 * Root layout: wraps the whole router tree in the SafeArea, React Query, and (via the
 * import side-effect above) i18n providers. On launch it hydrates the session (stored
 * refresh → silent restore, or clean anon) behind a brief splash. Light status bar.
 */
export default function RootLayout() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void hydrateSession();
  }, []);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="restaurant/[branchId]" />
          {/* Native branch menu (ORDER-3): list + read-only item detail. */}
          <Stack.Screen name="menu/[branchId]/index" />
          <Stack.Screen name="menu/[branchId]/[itemId]" />
          {/* Filters = bottom sheet via modal route; login stub = dimmed bottom sheet. */}
          <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
          <Stack.Screen
            name="login"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
          {/* Booking sheet = dimmed bottom sheet over the detail screen. */}
          <Stack.Screen
            name="booking"
            options={{ presentation: 'transparentModal', animation: 'fade' }}
          />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
