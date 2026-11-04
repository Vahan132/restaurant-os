'use client';

import { useTranslations } from 'next-intl';

import { usePublicTableSessionsControllerView } from '@/api/generated/public/public';
import {
  AttachedOrderStatusResponseOrderStatus as OrderStatus,
  AttachedOrderStatusResponsePaymentStatus as PaymentStatus,
} from '@/api/generated/model';
import type {
  AttachedOrderStatusResponse,
  PublicTableSessionViewResponse,
} from '@/api/generated/model';
import type { ApiError } from '@/api/mutator';

interface Props {
  qr: string;
  /** Highlight the order the customer just paid for. */
  highlightOrderId?: string | null;
  enabled?: boolean;
}

/** Kitchen statuses that never change again — stop polling once all orders reach one. */
const TERMINAL: ReadonlySet<string> = new Set([
  OrderStatus.SERVED,
  OrderStatus.CLOSED,
  OrderStatus.CANCELLED,
]);

/** Ordered lifecycle for the progress bar (DRAFT/CANCELLED handled separately). */
const STEPS: readonly string[] = [
  OrderStatus.SENT_TO_KITCHEN,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.SERVED,
];

/**
 * Live view of every order on the scanned table (ORDER-2). Polls the
 * table-scoped session view — the app has no sockets, so per the established
 * convention this uses TanStack Query `refetchInterval`, stopping once every
 * order is terminal. Exposing all of the table's orders to any scanner is an
 * accepted, by-design exposure.
 *
 * Reused both on the post-payment screen and on a revisit (reattach), so it is
 * self-contained: it fetches, polls, and renders its own empty/list states.
 */
export default function SessionOrders({ qr, highlightOrderId, enabled = true }: Props) {
  const t = useTranslations('liveStatus');

  const { data, isLoading } = usePublicTableSessionsControllerView<
    PublicTableSessionViewResponse,
    ApiError
  >(
    { qr },
    {
      query: {
        enabled: enabled && !!qr,
        refetchInterval: (query) => {
          const view = query.state.data;
          if (!view?.active) return false; // no active session -> nothing to poll
          const orders = view.orders ?? [];
          const allTerminal =
            orders.length > 0 && orders.every((o) => TERMINAL.has(o.orderStatus));
          return allTerminal ? false : 5000;
        },
        refetchIntervalInBackground: true,
      },
    },
  );

  const orders = data?.orders ?? [];

  if (isLoading) {
    return (
      <p className="py-6 text-center text-sm text-gray-400" role="status">
        {t('loading')}
      </p>
    );
  }

  if (orders.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">{t('empty')}</p>;
  }

  return (
    <ul className="space-y-2.5" aria-live="polite" data-testid="session-orders">
      {orders.map((order) => (
        <OrderRow
          key={order.orderId}
          order={order}
          highlighted={order.orderId === highlightOrderId}
          statusLabel={t(`status.${order.orderStatus}`)}
          paidLabel={t('unpaid')}
          orderLabel={t('orderNumber', { number: order.orderNumber })}
        />
      ))}
    </ul>
  );
}

function OrderRow({
  order,
  highlighted,
  statusLabel,
  paidLabel,
  orderLabel,
}: {
  order: AttachedOrderStatusResponse;
  highlighted: boolean;
  statusLabel: string;
  paidLabel: string;
  orderLabel: string;
}) {
  const cancelled = order.orderStatus === OrderStatus.CANCELLED;
  const stepIndex = STEPS.indexOf(order.orderStatus);
  const reached = order.orderStatus === OrderStatus.CLOSED ? STEPS.length - 1 : stepIndex;

  return (
    <li
      data-testid="session-order"
      data-order-status={order.orderStatus}
      className={`rounded-xl border p-3 ${
        highlighted ? 'border-brand-accent bg-rose-50/40' : 'border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{orderLabel}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            cancelled
              ? 'bg-rose-100 text-rose-700'
              : order.orderStatus === OrderStatus.SERVED ||
                  order.orderStatus === OrderStatus.CLOSED
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {!cancelled ? (
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= reached ? 'bg-brand-accent' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      ) : null}

      {order.paymentStatus !== PaymentStatus.PAID ? (
        <p className="mt-1.5 text-xs text-amber-700">{paidLabel}</p>
      ) : null}
    </li>
  );
}
