import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAppOrdersControllerConfirm,
  useAppOrdersControllerCreate,
  useAppOrdersControllerValidate,
} from '@/api/generated/consumer-ordering/consumer-ordering';
import {
  cartCount,
  cartLineTotal,
  cartSubtotal,
  toCartLineDtos,
  useCartStore,
} from '@/store/cart';
import { formatMoney } from '@/lib/money';
import { colors } from '@/theme/theme';

/**
 * Cart review + checkout (ORDER-4). Shows the working cart (edit quantities), a
 * SERVER-VALIDATED total (validate-cart — never the client subtotal), then prepays:
 * create → confirm-payment. Idempotent: the created order id is retained, so a retry
 * after a failed confirm re-confirms the SAME order (no double order/charge), and the
 * pay button is disabled while a request is in flight (no double-tap).
 */
export default function CartScreen() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();

  const context = useCartStore((s) => s.context);
  const lines = useCartStore((s) => s.lines);
  const setLineQuantity = useCartStore((s) => s.setLineQuantity);
  const orderId = useCartStore((s) => s.orderId);
  const setCreatedOrder = useCartStore((s) => s.setCreatedOrder);

  const validate = useAppOrdersControllerValidate();
  const create = useAppOrdersControllerCreate();
  const confirm = useAppOrdersControllerConfirm();

  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  const appCart = useMemo(
    () => (context ? { qr: context.qr, lines: toCartLineDtos(lines) } : null),
    [context, lines],
  );
  // Re-validate whenever the cart contents change (server is authoritative on price).
  const cartKey = useMemo(() => JSON.stringify(appCart?.lines ?? []), [appCart]);
  const validateMutate = validate.mutate;
  useEffect(() => {
    if (appCart && appCart.lines.length > 0) {
      validateMutate({ data: appCart });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  const validated = validate.data;
  const currency = validated?.currency ?? undefined;
  const count = cartCount(lines);

  const handlePay = async () => {
    if (submitLock.current || !appCart || lines.length === 0) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      // Reuse an already-created order on retry (idempotent — never create twice).
      let id = orderId;
      if (!id) {
        const created = await create.mutateAsync({ data: appCart });
        id = created.orderId;
        setCreatedOrder(created.orderId, created.tableSessionId);
      }
      await confirm.mutateAsync({ orderId: id });
      router.replace(`/order/${id}` as Href);
    } catch (e) {
      const message = (e as { message?: string })?.message ?? t('order.payError');
      Alert.alert(t('order.payErrorTitle'), message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const Header = () => (
    <View className="flex-row items-center px-4 py-2">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        hitSlop={8}
        className="flex-row items-center active:opacity-70"
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
        <Text className="ml-1 text-base text-text">{t('order.cartTitle')}</Text>
      </Pressable>
    </View>
  );

  if (!context || lines.length === 0) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-bg">
        <Header />
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cart-outline" size={44} color={colors.textFaint} />
          <Text className="mt-4 text-lg font-semibold text-text">{t('order.emptyTitle')}</Text>
          <Text className="mt-1 text-center text-sm text-textMuted">{t('order.emptyHint')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            className="mt-6 rounded-xl border border-border px-5 py-3 active:opacity-80"
          >
            <Text className="font-semibold text-text">{t('detail.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const repriced =
    !!validated && validated.lines.length !== lines.length && !validate.isPending;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-bg">
      <Header />
      {context.tableName ? (
        <Text className="px-5 pb-1 text-sm text-textMuted">
          {t('order.table', { name: context.tableName })}
        </Text>
      ) : null}

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 220 }}>
        {lines.map((line) => (
          <View key={line.lineId} className="mb-3 rounded-2xl bg-surface p-3">
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 text-base font-semibold text-text">{line.name}</Text>
              <Text className="text-base font-semibold text-text">
                {currency ? formatMoney(cartLineTotal(line), currency) : ''}
              </Text>
            </View>
            {line.modifiers.length > 0 ? (
              <Text className="mt-1 text-sm text-textMuted">
                {line.modifiers.map((m) => m.name).join(', ')}
              </Text>
            ) : null}
            <View className="mt-3 flex-row items-center">
              <View className="flex-row items-center rounded-xl border border-border">
                <Pressable
                  accessibilityLabel={t('order.decrease')}
                  onPress={() => setLineQuantity(line.lineId, line.quantity - 1)}
                  hitSlop={6}
                  className="h-9 w-10 items-center justify-center active:opacity-70"
                >
                  <Ionicons
                    name={line.quantity <= 1 ? 'trash-outline' : 'remove'}
                    size={18}
                    color={line.quantity <= 1 ? colors.textMuted : colors.text}
                  />
                </Pressable>
                <Text className="w-8 text-center font-semibold text-text">{line.quantity}</Text>
                <Pressable
                  accessibilityLabel={t('order.increase')}
                  onPress={() => setLineQuantity(line.lineId, line.quantity + 1)}
                  hitSlop={6}
                  className="h-9 w-10 items-center justify-center active:opacity-70"
                >
                  <Ionicons name="add" size={18} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {repriced ? (
          <View className="mt-2 flex-row items-center gap-2 rounded-xl bg-surfaceAlt p-3">
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text className="flex-1 text-xs text-textMuted">{t('order.repriced')}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Totals + pay. */}
      <View
        className="absolute inset-x-0 bottom-0 border-t border-border bg-bg px-5 pt-4"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {validated ? (
          <View className="mb-3">
            <Row label={t('order.subtotal')} value={formatMoney(validated.subtotalAmount, validated.currency)} />
            {validated.serviceFeeAmount > 0 ? (
              <Row
                label={t('order.serviceFee')}
                value={formatMoney(validated.serviceFeeAmount, validated.currency)}
              />
            ) : null}
            <Row
              label={t('order.total')}
              value={formatMoney(validated.totalAmount, validated.currency)}
              emphasize
            />
          </View>
        ) : (
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-textMuted">{t('order.total')}</Text>
            {validate.isPending ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              <Text className="text-textMuted">{formatMoney(cartSubtotal(lines), currency ?? '')}</Text>
            )}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={submitting || validate.isError}
          onPress={() => void handlePay()}
          className={`h-14 flex-row items-center justify-center rounded-2xl ${
            submitting || validate.isError ? 'bg-surfaceAlt' : 'bg-accent active:opacity-90'
          }`}
        >
          {submitting ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text
              className={`text-base font-bold ${
                validate.isError ? 'text-textFaint' : 'text-accentText'
              }`}
            >
              {t('order.payNow', { count })}
            </Text>
          )}
        </Pressable>
        {validate.isError ? (
          <Text className="mt-2 text-center text-xs text-textMuted">{t('order.validateError')}</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className={emphasize ? 'text-base font-semibold text-text' : 'text-sm text-textMuted'}>
        {label}
      </Text>
      <Text className={emphasize ? 'text-base font-bold text-text' : 'text-sm text-text'}>
        {value}
      </Text>
    </View>
  );
}
