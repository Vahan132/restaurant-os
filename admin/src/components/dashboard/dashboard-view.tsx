'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import {
  getReportsControllerGetDashboardQueryKey,
  useReportsControllerGetDashboard,
} from '@/api/generated/reports/reports';
import { StatCard } from '@/components/dashboard/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePermission } from '@/lib/auth/use-permission';
import { useDashboardLive } from '@/lib/dashboard/use-dashboard-live';
import { formatMoney } from '@/lib/money';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const orderTone = (status: string): 'green' | 'gray' | 'red' | 'amber' | 'blue' => {
  const s = status.toUpperCase();
  if (s.includes('CANCEL')) return 'red';
  if (s.includes('CLOSED') || s.includes('PAID') || s.includes('COMPLETED')) return 'green';
  if (s.includes('OPEN')) return 'amber';
  return 'blue';
};

export function DashboardView() {
  const t = useTranslations('dashboard');
  const canView = usePermission(PERMISSIONS.DASHBOARD_VIEW);
  const qc = useQueryClient();
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';

  const { data, isLoading, isError } = useReportsControllerGetDashboard({
    query: { enabled: canView },
  });
  useDashboardLive();

  if (!canView) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500">{t('empty')}</p>
      </div>
    );
  }

  const revenue =
    data != null
      ? formatMoney(data.todaysRevenueAmount, currency)
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            void qc.invalidateQueries({ queryKey: getReportsControllerGetDashboardQueryKey() })
          }
        >
          ↻ {t('refresh')}
        </Button>
      </div>

      {isError ? (
        <p className="text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t('todaysRevenue')} value={revenue} loading={isLoading} />
            <StatCard label={t('ordersToday')} value={data?.ordersToday ?? 0} loading={isLoading} />
            <StatCard label={t('openOrders')} value={data?.openOrders ?? 0} loading={isLoading} />
            <StatCard
              label={t('occupiedTables')}
              value={data?.occupiedTables ?? 0}
              loading={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('topItems')}</h2>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
                  ))}
                </div>
              ) : !data || data.topItemsToday.length === 0 ? (
                <p className="text-sm text-gray-500">{t('noTopItems')}</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.topItemsToday.map((item) => (
                    <li key={item.menuItemId} className="flex justify-between py-2 text-sm">
                      <span className="text-gray-800">{item.name}</span>
                      <span className="tabular-nums text-gray-500">× {item.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('recentOrders')}</h2>
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
                  ))}
                </div>
              ) : !data || data.recentOrders.length === 0 ? (
                <p className="text-sm text-gray-500">{t('noRecentOrders')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="py-1 font-medium">{t('order')}</th>
                      <th className="py-1 font-medium">{t('table')}</th>
                      <th className="py-1 font-medium">{t('total')}</th>
                      <th className="py-1 font-medium">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((o) => (
                      <tr key={o.orderId} className="border-t border-gray-100">
                        <td className="py-1.5 font-medium text-gray-800">#{o.orderNumber}</td>
                        <td className="py-1.5 text-gray-600">{o.tableName ?? '—'}</td>
                        <td className="py-1.5 tabular-nums text-gray-700">
                          {formatMoney(o.totalAmount, currency)}
                        </td>
                        <td className="py-1.5">
                          <Badge tone={orderTone(o.status)}>{o.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
