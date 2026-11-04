'use client';

import { useTranslations } from 'next-intl';

import { DailyInventoryReport } from '@/components/inventory/daily-inventory-report';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';

/** DAILY-INV-1: page shell for the end-of-day inventory report. */
export function DailyInventoryReportManager() {
  const t = useTranslations('inventory');
  const canView = usePermission(PERMISSIONS.INVENTORY_READ);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t('dailyTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dailySubtitle')}</p>
      </div>
      {canView ? (
        <DailyInventoryReport />
      ) : (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('repRestricted')}
        </p>
      )}
    </div>
  );
}
