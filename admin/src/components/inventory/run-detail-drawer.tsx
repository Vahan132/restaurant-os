'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Drawer } from '@/components/ui/drawer';
import { formatDateTime } from '@/components/inventory/shared';
import { useRun } from '@/lib/inventory/use-process-data';
import { formatNumber } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

export function RunDetailDrawer({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { data: runDetail, isLoading } = useRun(runId);

  return (
    <Drawer open title={t('runDetailTitle')} onClose={onClose}>
      {isLoading || !runDetail ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">{t('rdProcess')}</dt>
            <dd className="text-gray-800">
              {runDetail.processName}
              {runDetail.wentNegative && (
                <span className="ml-2">
                  <Badge tone="amber">{t('wentNegativeBadge')}</Badge>
                </span>
              )}
            </dd>
            <dt className="text-gray-500">{t('rdRunAt')}</dt>
            <dd className="text-gray-800">{formatDateTime(runDetail.runAt)}</dd>
            <dt className="text-gray-500">{t('rdMultiplier')}</dt>
            <dd className="text-gray-800">×{runDetail.multiplier}</dd>
          </dl>

          {/* Cost breakdown */}
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t('rdInputCost')}</span>
              <span>{formatMoney(runDetail.inputCost, currency)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('rdProcessingCost')}</span>
              <span>{formatMoney(runDetail.processingCost, currency)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-medium text-gray-900">
              <span>{t('rdTotalCost')}</span>
              <span>{formatMoney(runDetail.totalCost, currency)}</span>
            </div>
          </div>

          {/* Consumed inputs */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('rdConsumed')}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">{t('rdItem')}</th>
                  <th className="py-2 pr-3 font-medium">{t('rdQty')}</th>
                  <th className="py-2 font-medium">{t('rdCost')}</th>
                </tr>
              </thead>
              <tbody>
                {runDetail.consumedInputs.map((c, i) => (
                  <tr key={`${c.itemId}-${i}`} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{c.itemName}</td>
                    <td className="py-2 pr-3 text-gray-700">{formatNumber(c.qtyBase)}</td>
                    <td className="py-2 text-gray-700">{formatMoney(c.cost, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Produced outputs */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('rdProduced')}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">{t('rdItem')}</th>
                  <th className="py-2 pr-3 font-medium">{t('rdQty')}</th>
                  <th className="py-2 pr-3 font-medium">{t('rdAllocated')}</th>
                  <th className="py-2 font-medium">{t('rdUnitCost')}</th>
                </tr>
              </thead>
              <tbody>
                {runDetail.producedOutputs.map((o, i) => (
                  <tr key={`${o.itemId}-${i}`} className="border-b border-gray-100">
                    <td className="py-2 pr-3 font-medium text-gray-800">{o.itemName}</td>
                    <td className="py-2 pr-3 text-gray-700">{formatNumber(o.qtyBase)}</td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatMoney(o.allocatedCost, currency)}
                    </td>
                    <td className="py-2 text-gray-700">
                      {formatMoney(o.derivedUnitCost, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Drawer>
  );
}
