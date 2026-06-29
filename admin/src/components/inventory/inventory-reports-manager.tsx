'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { LowStockReport } from '@/components/inventory/low-stock-report';
import { MovementsReport } from '@/components/inventory/movements-report';
import { StockOnHandReport } from '@/components/inventory/stock-on-hand-report';
import { ValuationReport } from '@/components/inventory/valuation-report';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';

type Tab = 'onHand' | 'valuation' | 'lowStock' | 'movements';

export function InventoryReportsManager() {
  const t = useTranslations('inventory');
  const canView = usePermission(PERMISSIONS.INVENTORY_READ);
  const [tab, setTab] = useState<Tab>('onHand');

  if (!canView) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('reportsTitle')}</h1>
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('repRestricted')}
        </p>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'onHand', label: t('repTabOnHand') },
    { key: 'valuation', label: t('repTabValuation') },
    { key: 'lowStock', label: t('repTabLowStock') },
    { key: 'movements', label: t('repTabMovements') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('reportsTitle')}</h1>

      <div className="flex gap-1 border-b border-gray-200">
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

      {tab === 'onHand' && <StockOnHandReport />}
      {tab === 'valuation' && <ValuationReport />}
      {tab === 'lowStock' && <LowStockReport />}
      {tab === 'movements' && <MovementsReport />}
    </div>
  );
}
