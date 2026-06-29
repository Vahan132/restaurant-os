'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { OrderResponse, OrderResponseStatus } from '@/api/generated/model';
import { useMoney } from '@/lib/useMoney';
import { OrderRequestsBell } from '@/components/requests/OrderRequestsBell';
import { BranchMenu } from '@/components/branch/BranchMenu';

const ORDER_STATUS_BADGE: Record<OrderResponseStatus, string> = {
  DRAFT: 'bg-gray-200 text-gray-700',
  SENT_TO_KITCHEN: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-amber-100 text-amber-700',
  READY: 'bg-green-100 text-green-700',
  SERVED: 'bg-gray-100 text-gray-600',
  CLOSED: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-700',
};

interface OrderHeaderProps {
  order: OrderResponse;
  /** Resolved table name, if a dine-in order. */
  tableName?: string;
}

export function OrderHeader({ order, tableName }: OrderHeaderProps) {
  const t = useTranslations('builder');
  const tStatus = useTranslations('orderStatus');
  const router = useRouter();
  const { format } = useMoney();

  const where =
    order.type === 'TAKEAWAY' ? t('takeaway') : (tableName ?? t('tableFallback'));

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="flex h-12 w-12 select-none items-center justify-center rounded-xl border border-gray-300 text-xl active:scale-95"
          aria-label="back"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold leading-tight text-gray-900">
            #{order.orderNumber} · {where}
          </h1>
          <span
            data-testid="pos-order-status"
            data-status={order.status}
            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${ORDER_STATUS_BADGE[order.status]}`}
          >
            {tStatus(order.status)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <BranchMenu />
        <OrderRequestsBell />
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('total')}</p>
          <p className="text-2xl font-bold text-gray-900">{format(order.totals.totalAmount)}</p>
        </div>
      </div>
    </div>
  );
}
