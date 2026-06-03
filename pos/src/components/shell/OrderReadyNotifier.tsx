'use client';

import { useTranslations } from 'next-intl';
import { useRealtimeEvent } from '@/lib/realtime/useRealtimeEvent';
import { toast, playNotificationSound } from '@/lib/toast';
import { useAuthMe } from '@/lib/useAuthMe';

/**
 * Listens for "order.ready" and fires a toast (+ optional sound) when one of the
 * CURRENT user's orders is ready to serve. Renders nothing.
 */
export function OrderReadyNotifier() {
  const t = useTranslations('notifications');
  const { data: me } = useAuthMe();

  useRealtimeEvent('order.ready', (e) => {
    // Target this device: show only the signed-in waiter's orders. If the event
    // carries no waiterId, show it anyway (server may already scope the channel).
    if (e.waiterId && me?.user.id && e.waiterId !== me.user.id) return;

    const tableLabel = e.tableName ?? e.tableId ?? e.orderNumber ?? '';
    toast.success(t('orderReady'), t('orderReadyForTable', { table: tableLabel }));
    playNotificationSound();
  });

  return null;
}
