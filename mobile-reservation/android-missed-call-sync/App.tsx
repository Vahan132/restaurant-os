/**
 * Root component (R-AND-1).
 *
 * Routes between the pairing flow and the home/status screen based on whether
 * the device is paired. Keeps things deliberately minimal — this is an internal
 * single-purpose utility, not a multi-tab app.
 */
import { useEffect, useState } from 'react';
import { Platform, SafeAreaView, StatusBar, Text, View } from 'react-native';

import { HomeScreen } from './src/ui/HomeScreen';
import { SetupScreen } from './src/ui/SetupScreen';
import { useSyncManager } from './src/ui/useSyncManager';
import { colors } from './src/ui/theme';

type Route = 'home' | 'setup';

export default function App() {
  const snap = useSyncManager();
  const [route, setRoute] = useState<Route | null>(null);

  // Decide the initial route once the manager has loaded config from storage.
  useEffect(() => {
    if (route !== null) return;
    if (snap.serviceState === 'unpaired' && !snap.config) setRoute('setup');
    else if (snap.config) setRoute('home');
  }, [snap.config, snap.serviceState, route]);

  if (Platform.OS !== 'android') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Text style={{ color: colors.text, textAlign: 'center', padding: 24 }}>
          This app is Android-only — it reads the Android call log.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      {route === 'setup' || (!snap.config && route !== 'home') ? (
        <SetupScreen
          initialBaseUrl={snap.config?.baseUrl}
          onPaired={() => setRoute('home')}
          onCancel={snap.config ? () => setRoute('home') : undefined}
        />
      ) : route === 'home' ? (
        <HomeScreen onRepair={() => setRoute('setup')} />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </SafeAreaView>
  );
}
