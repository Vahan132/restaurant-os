import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useAppOrdersControllerReceipt } from '@/api/generated/consumer-ordering/consumer-ordering';
import { useCartStore } from '@/store/cart';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme/theme';

const TERMINAL = new Set(['CLOSED', 'CANCELLED']);

/**
 * Order confirmation (ORDER-4): fiscal receipt QR + live status. Polls the receipt while
 * the order is active. Paid-but-unfiscalized (fiscalized:false) is expected briefly — we
 * show "receipt processing" and keep polling; the order is placed, the QR just lags.
 * "Order more" loops back to the menu (same table session); "Done" ends the flow.
 */
export default function OrderReceiptScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { t } = useTranslation('common');
  const context = useCartStore((s) => s.context);
  const clearLines = useCartStore((s) => s.clearLines);
  const endOrdering = useCartStore((s) => s.endOrdering);

  // Poll every 3s while the order is active; stop once fiscalized AND status has settled
  // (READY/SERVED), or the order is terminal. This also covers the brief
  // paid-but-unfiscalized wait (fiscalized:false keeps polling).
  const receipt = useAppOrdersControllerReceipt(orderId, {
    query: {
      enabled: !!orderId,
      refetchInterval: (query) => {
        const d = query.state.data;
        if (!d) return 3000;
        const settled = d.fiscalized && (d.status === 'SERVED' || d.status === 'READY');
        return TERMINAL.has(d.status) || settled ? false : 3000;
      },
    },
  });
  const data = receipt.data;

  const orderMore = () => {
    clearLines();
    if (context) {
      router.replace({ pathname: '/menu/[branchId]', params: { branchId: context.branchId } });
    } else {
      router.replace('/' as Href);
    }
  };
  const finish = () => {
    endOrdering();
    router.replace('/' as Href);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <View className="flex-row items-center px-4 py-2">
        <Pressable accessibilityRole="button" onPress={finish} hitSlop={8} className="active:opacity-70">
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
        <Text className="ml-2 text-base font-semibold text-text">{t('order.receiptTitle')}</Text>
      </View>

      {!data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={56} color={colors.accent} />
          <Text className="mt-3 text-xl font-bold text-text">{t('order.placedTitle')}</Text>
          <Text className="mt-1 text-textMuted">
            {t('order.orderNumber', { number: data.orderNumber })}
          </Text>

          {/* Live status pill. */}
          <View className="mt-4 rounded-full bg-surfaceAlt px-4 py-1.5">
            <Text className="text-sm font-medium text-text">{statusLabel(data.status, t)}</Text>
          </View>

          <Text className="mt-4 text-2xl font-bold text-text">
            {formatMoney(data.totalAmount, data.currency)}
          </Text>

          {/* Fiscal receipt QR, or the processing state while fiscalization lags. */}
          <View className="mt-8 w-full items-center">
            {data.fiscalized && data.fiscal ? (
              <>
                <View className="rounded-2xl bg-white p-4">
                  <QRCode value={data.fiscal.qr} size={200} />
                </View>
                <Text className="mt-3 text-xs text-textFaint">
                  {t('order.fiscalNumber', { number: data.fiscal.fiscalNumber })}
                </Text>
              </>
            ) : (
              <View className="items-center rounded-2xl border border-border p-6">
                <ActivityIndicator color={colors.textMuted} />
                <Text className="mt-3 text-center text-sm text-textMuted">
                  {t('order.receiptProcessing')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Actions. */}
      <View className="flex-row gap-3 px-5 pb-6 pt-2">
        <Pressable
          accessibilityRole="button"
          onPress={orderMore}
          className="h-12 flex-1 items-center justify-center rounded-xl border border-border active:opacity-80"
        >
          <Text className="font-semibold text-text">{t('order.orderMore')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={finish}
          className="h-12 flex-1 items-center justify-center rounded-xl bg-accent active:opacity-80"
        >
          <Text className="font-semibold text-accentText">{t('order.done')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function statusLabel(
  status: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const key = `order.status.${status}`;
  const label = t(key);
  // If a status has no explicit translation, fall back to the raw code.
  return label === key ? status : label;
}
