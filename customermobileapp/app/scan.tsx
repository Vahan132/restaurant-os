import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { publicStorefrontControllerTable } from '@/api/generated/public/public';
import { useRequireAuth } from '@/lib/auth-gate';
import { parseTableQr } from '@/lib/table-qr';
import type { OrderingContext } from '@/store/cart';
import { colors } from '@/theme/theme';

/**
 * Table-QR scanner (ORDER-4). Scan → parse → resolve the table (server-authoritative
 * branch) → auth gate → begin ordering. Every failure path is graceful: permission
 * denied offers Settings, an unrecognized code or a not-found table shows a message and
 * a "scan again" affordance — never a dead-end or crash.
 */
export default function ScanScreen() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const requireAuth = useRequireAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One-shot lock so a burst of frames doesn't fire multiple resolves.
  const lockRef = useRef(false);

  const resetScan = useCallback(() => {
    lockRef.current = false;
    setError(null);
    setResolving(false);
  }, []);

  const handleScan = useCallback(
    async (raw: string) => {
      if (lockRef.current) return;
      lockRef.current = true;

      const parsed = parseTableQr(raw);
      if (!parsed) {
        setError(t('scan.invalidBody'));
        return;
      }

      setResolving(true);
      try {
        // Resolve the table within its restaurant (explicit slug header — the ordering
        // context isn't set yet). Returns the authoritative branch id + slug.
        const table = await publicStorefrontControllerTable(
          { qr: parsed.qr },
          { headers: { 'X-Restaurant-Slug': parsed.restaurantSlug } },
        );
        const context: OrderingContext = {
          restaurantSlug: parsed.restaurantSlug,
          branchSlug: parsed.branchSlug ?? table.branchSlug,
          branchId: table.branchId,
          qr: parsed.qr,
          tableName: table.name,
        };
        // Ordering requires a logged-in consumer. If anon, this stashes the intent,
        // opens login, and resumes here on success; if authed, it runs immediately.
        requireAuth({ type: 'order', context });
      } catch {
        setResolving(false);
        setError(t('scan.notFound'));
      }
    },
    [requireAuth, t],
  );

  // Permission still loading.
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Not granted — ask, or (if permanently denied) send to Settings.
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <ScanHeader onClose={() => router.back()} title={t('scan.title')} />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="camera-outline" size={48} color={colors.textFaint} />
          <Text className="mt-4 text-center text-lg font-semibold text-text">
            {t('scan.permissionTitle')}
          </Text>
          <Text className="mt-1 text-center text-sm text-textMuted">
            {permission.canAskAgain ? t('scan.permissionBody') : t('scan.deniedBody')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
            }
            className="mt-6 rounded-xl bg-accent px-6 py-3 active:opacity-80"
          >
            <Text className="font-semibold text-accentText">
              {permission.canAskAgain ? t('scan.grant') : t('scan.openSettings')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={resolving || error ? undefined : (e) => void handleScan(e.data)}
      />

      {/* Overlay chrome. */}
      <SafeAreaView className="absolute inset-x-0 top-0">
        <ScanHeader onClose={() => router.back()} title={t('scan.title')} tint="light" />
      </SafeAreaView>

      {/* Reticle + hint. */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
        <View className="h-56 w-56 rounded-3xl border-2 border-white/80" />
        <Text className="mt-6 px-10 text-center text-white/90">{t('scan.hint')}</Text>
      </View>

      {resolving ? (
        <View className="absolute inset-0 items-center justify-center bg-black/60">
          <ActivityIndicator color="#fff" />
          <Text className="mt-3 text-white">{t('scan.resolving')}</Text>
        </View>
      ) : null}

      {error ? (
        <View className="absolute inset-x-0 bottom-0 items-center bg-black/80 px-8 pb-12 pt-6">
          <Ionicons name="alert-circle-outline" size={32} color="#fff" />
          <Text className="mt-2 text-center text-base font-semibold text-white">
            {t('scan.invalidTitle')}
          </Text>
          <Text className="mt-1 text-center text-sm text-white/70">{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={resetScan}
            className="mt-5 rounded-xl bg-accent px-6 py-3 active:opacity-80"
          >
            <Text className="font-semibold text-accentText">{t('scan.scanAgain')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ScanHeader({
  onClose,
  title,
  tint = 'dark',
}: {
  onClose: () => void;
  title: string;
  tint?: 'dark' | 'light';
}) {
  const color = tint === 'light' ? '#fff' : colors.text;
  return (
    <View className="flex-row items-center px-4 py-2">
      <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} className="active:opacity-70">
        <Ionicons name="close" size={26} color={color} />
      </Pressable>
      <Text className="ml-2 text-base font-semibold" style={{ color }}>
        {title}
      </Text>
    </View>
  );
}
