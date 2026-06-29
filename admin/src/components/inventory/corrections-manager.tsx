'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountCorrectionModal } from '@/components/inventory/count-correction-modal';
import { usePermission } from '@/lib/auth/use-permission';
import { useNegativeWorklist } from '@/lib/inventory/use-locations-data';
import { formatNumber } from '@/lib/inventory/units';
import { PERMISSIONS } from '@/lib/permissions';

interface Prefill {
  itemId: string;
  locationId: string;
}

export function CorrectionsManager() {
  const t = useTranslations('inventory');
  const canCorrect = usePermission(PERMISSIONS.INVENTORY_ADJUSTMENT_CREATE);

  const { negatives, isLoading, isError } = useNegativeWorklist();

  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  const openBlank = () => {
    setPrefill(null);
    setModalOpen(true);
  };
  const openFor = (itemId: string, locationId: string) => {
    setPrefill({ itemId, locationId });
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('correctionsTitle')}</h1>
        {canCorrect && (
          <Button variant="primary" onClick={openBlank}>
            + {t('ccNew')}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">{t('negativeWorklistTitle')}</h2>
        <p className="text-sm text-gray-500">{t('negativeWorklistIntro')}</p>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
              ))}
            </div>
          ) : isError ? (
            <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
          ) : negatives.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">{t('noNegatives')}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-medium">{t('colItem')}</th>
                  <th className="px-4 py-2 font-medium">{t('ccLocation')}</th>
                  <th className="px-4 py-2 font-medium">{t('negCurrentQty')}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {negatives.map((row) => (
                  <tr key={`${row.itemId}::${row.locationId}`} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">{row.itemName}</td>
                    <td className="px-4 py-2 text-gray-600">{row.locationName}</td>
                    <td className="px-4 py-2">
                      <Badge tone="red">
                        {formatNumber(row.quantity)} {row.baseUnit}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canCorrect && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openFor(row.itemId, row.locationId)}
                        >
                          {t('ccCorrect')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <CountCorrectionModal prefill={prefill} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}
