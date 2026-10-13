'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PERMISSIONS, useEffectivePermissions } from '@/lib/permissions';
import { usePendingOrderRequests, useOrderRequestsInvalidator } from '@/lib/useOrderRequests';
import { useRealtimeEvent } from '@/lib/realtime/useRealtimeEvent';
import { useRequestSound } from '@/lib/requestSound';
import { toast, playNotificationSound } from '@/lib/toast';
import { OrderRequestsPanel } from './OrderRequestsPanel';

/**
 * Top-bar bell + PENDING badge for incoming customer order requests. Present on
 * every POS screen (embedded in each screen's header). Subscribes to the P1
 * realtime room: "order_request.new" bumps the badge + toast + optional sound;
 * "order_request.updated" refetches so handled requests drop off. Hidden entirely
 * for users without ORDER_CREATE or ORDER_EDIT.
 */
export function OrderRequestsBell() {
  const t = useTranslations('requests');
  const perms = useEffectivePermissions();
  const visible = perms.includes(PERMISSIONS.ORDER_CREATE) || perms.includes(PERMISSIONS.ORDER_EDIT);

  const { count } = usePendingOrderRequests();
  const invalidate = useOrderRequestsInvalidator();
  const { muted, toggle } = useRequestSound();
  const [open, setOpen] = useState(false);

  useRealtimeEvent('order_request.new', () => {
    invalidate();
    toast.info(t('newTitle'), t('newBody'));
    if (!muted) playNotificationSound();
  });
  useRealtimeEvent('order_request.updated', () => invalidate());

  if (!visible) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="requests-bell"
          onClick={() => setOpen(true)}
          aria-label={t('title')}
          className="relative flex h-12 w-12 select-none items-center justify-center rounded-xl border border-gray-300 bg-white text-xl active:scale-95"
        >
          🔔
          {count > 0 ? (
            <span
              data-testid="requests-badge"
              className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white"
            >
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={muted}
          title={muted ? t('unmute') : t('mute')}
          className="flex h-12 w-10 select-none items-center justify-center rounded-xl text-lg text-gray-500 active:scale-95"
        >
          {muted ? '🔕' : '🔊'}
        </button>
      </div>

      {open ? <OrderRequestsPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}
