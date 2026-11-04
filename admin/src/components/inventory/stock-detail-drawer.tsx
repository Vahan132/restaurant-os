'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { AlternateUnitView } from '@/api/generated/model';
import { Drawer } from '@/components/ui/drawer';
import { Toggle } from '@/components/ui/toggle';
import {
  LayerStatusBadge,
  Pagination,
  formatDate,
  formatDateTime,
} from '@/components/inventory/shared';
import { useItemLayers, useItemMovements } from '@/lib/inventory/use-inventory-data';
import { BASE_UNIT_ABBR, formatNumber, type BaseUnit } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';

const PAGE_SIZE = 20;
type Tab = 'layers' | 'movements';

export function StockDetailDrawer({
  itemId,
  itemName,
  baseUnit,
  onClose,
}: {
  itemId: string;
  itemName: string;
  baseUnit: string;
  alternateUnits: AlternateUnitView[];
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const abbr = BASE_UNIT_ABBR[baseUnit as BaseUnit] ?? baseUnit;

  const [tab, setTab] = useState<Tab>('layers');
  const [showDepleted, setShowDepleted] = useState(false);
  const [page, setPage] = useState(1);

  const { layers, isLoading: layersLoading } = useItemLayers(itemId, showDepleted);
  const movParams = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const {
    movements,
    pagination,
    isLoading: movLoading,
  } = useItemMovements(tab === 'movements' ? itemId : null, movParams);
  const hasNext = pagination?.hasNext ?? movements.length === PAGE_SIZE;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'layers', label: t('tabLayers') },
    { key: 'movements', label: t('tabMovements') },
  ];

  const signedQty = (qty: number) =>
    `${qty > 0 ? '+' : ''}${formatNumber(qty)} ${abbr}`;

  return (
    <Drawer open title={itemName} onClose={onClose}>
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'layers' ? (
        <div className="space-y-3">
          <div className="w-48">
            <Toggle
              label={t('showDepleted')}
              checked={showDepleted}
              onChange={setShowDepleted}
            />
          </div>
          {layersLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : layers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{t('noLayers')}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3 font-medium">{t('layerReceived')}</th>
                  <th className="py-2 pr-3 font-medium">{t('layerExpiry')}</th>
                  <th className="py-2 pr-3 font-medium">{t('layerRemaining')}</th>
                  <th className="py-2 pr-3 font-medium">{t('layerUnitCost')}</th>
                  <th className="py-2 font-medium">{t('layerStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer) => (
                  <tr key={layer.layerId} className="border-b border-gray-100">
                    <td className="py-2 pr-3 text-gray-700">{formatDate(layer.receivedAt)}</td>
                    <td className="py-2 pr-3 text-gray-600">{formatDate(layer.expiryDate)}</td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatNumber(layer.baseQtyRemaining)} {abbr}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatMoney(Number(layer.unitCostMicro) / 1e6, currency)}
                    </td>
                    <td className="py-2">
                      <LayerStatusBadge status={layer.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {movLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">{t('noMovements')}</p>
          ) : (
            <>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-medium">{t('movDate')}</th>
                    <th className="py-2 pr-3 font-medium">{t('movType')}</th>
                    <th className="py-2 pr-3 font-medium">{t('movQty')}</th>
                    <th className="py-2 pr-3 font-medium">{t('movCost')}</th>
                    <th className="py-2 font-medium">{t('movReason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mov) => (
                    <tr key={mov.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-gray-600">{formatDateTime(mov.occurredAt)}</td>
                      <td className="py-2 pr-3 text-gray-700">{mov.type}</td>
                      <td
                        className={`py-2 pr-3 font-medium ${
                          mov.baseQty < 0 ? 'text-red-600' : 'text-green-700'
                        }`}
                      >
                        {signedQty(mov.baseQty)}
                      </td>
                      <td className="py-2 pr-3 text-gray-700">
                        {formatMoney(mov.costAmount, currency)}
                      </td>
                      <td className="py-2 text-gray-600">
                        {mov.reason ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                hasNext={hasNext}
              />
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
