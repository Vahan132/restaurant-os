'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import type { TableResponse } from '@/api/generated/model';
import { QrPrintGrid, type QrPrintItem } from '@/components/qr/qr-print-grid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import { buildCustomerUrl } from '@/lib/qr/customer-url';
import { useGenerateQr } from '@/lib/qr/use-generate-qr';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { useFloors, useRestaurantSettings, useTables } from '@/lib/tables/use-tables-data';
import { toast } from '@/stores/toast';

export function QrManager() {
  const t = useTranslations('qr');
  const canManage = usePermission(PERMISSIONS.TABLE_MANAGE);

  const { data: restaurant } = useRestaurant();
  const { settings } = useRestaurantSettings();
  const { floors } = useFloors(false);
  const { tables, isLoading } = useTables();
  const { generate, invalidate, pendingId } = useGenerateQr();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const slug = restaurant?.slug ?? '';
  const restaurantName = restaurant?.name ?? '';
  const logoUrl = settings?.logoUrl ?? null;

  const tablesByFloor = useMemo(() => {
    const map = new Map<string, TableResponse[]>();
    for (const tbl of tables) {
      const list = map.get(tbl.floorId) ?? [];
      list.push(tbl);
      map.set(tbl.floorId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [tables]);

  const urlFor = (tbl: TableResponse) =>
    tbl.qrIdentifier && slug ? buildCustomerUrl(slug, tbl.qrIdentifier) : '';

  const withIdentifier = useMemo(() => tables.filter((tbl) => !!tbl.qrIdentifier), [tables]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const generateOne = async (tbl: TableResponse) => {
    try {
      await generate(tbl.id);
      await invalidate();
      toast.success(t('toast.generated'));
    } catch (err) {
      toast.error(getErrorMessage(err, t('toast.failed')));
    }
  };

  const generateAll = async () => {
    const targets = tables.filter((tbl) => !tbl.qrIdentifier);
    let count = 0;
    for (const tbl of targets) {
      try {
        await generate(tbl.id);
        count += 1;
      } catch {
        // continue; individual failures are reported by the final toast count
      }
    }
    await invalidate();
    if (count > 0) toast.success(t('toast.bulkGenerated', { count }));
    else toast.error(t('toast.failed'));
  };

  const selectedItems: QrPrintItem[] = withIdentifier
    .filter((tbl) => selected.has(tbl.id))
    .map((tbl) => ({ id: tbl.id, name: tbl.name, url: urlFor(tbl) }));

  const print = () => {
    if (selectedItems.length === 0) {
      toast.error(t('noSelection'));
      return;
    }
    window.print();
  };

  if (!canManage) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          {t('intro')}
        </p>
      </div>
    );
  }

  const sortedFloors = [...floors];

  return (
    <div className="space-y-6">
      <div className="qr-no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('intro')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => setSelected(new Set(withIdentifier.map((tbl) => tbl.id)))}
            disabled={withIdentifier.length === 0}
          >
            {t('selectAll')}
          </Button>
          <Button variant="secondary" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            {t('clearSel')}
          </Button>
          <Button variant="secondary" onClick={generateAll}>
            {t('generateAll')}
          </Button>
          <Button variant="primary" onClick={print} disabled={selectedItems.length === 0}>
            {t('print')} · {t('selected', { count: selectedItems.length })}
          </Button>
        </div>
      </div>

      <div className="qr-no-print space-y-6">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noTables')}</p>
        ) : (
          sortedFloors.map((floor) => {
            const floorTables = tablesByFloor.get(floor.id) ?? [];
            if (floorTables.length === 0) return null;
            return (
              <section key={floor.id}>
                <h2 className="mb-2 text-sm font-semibold text-gray-900">{floor.name}</h2>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-2 font-medium" />
                        <th className="px-4 py-2 font-medium">{t('table')}</th>
                        <th className="px-4 py-2 font-medium">{t('identifier')}</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {floorTables.map((tbl) => (
                        <tr key={tbl.id} className="border-b border-gray-100">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={selected.has(tbl.id)}
                              disabled={!tbl.qrIdentifier}
                              onChange={() => toggle(tbl.id)}
                              aria-label={t('select')}
                            />
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-800">{tbl.name}</td>
                          <td className="px-4 py-2">
                            {tbl.qrIdentifier ? (
                              <span className="font-mono text-xs text-gray-600">{tbl.qrIdentifier}</span>
                            ) : (
                              <Badge tone="gray">{t('notSet')}</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => generateOne(tbl)}
                              disabled={pendingId === tbl.id}
                            >
                              {tbl.qrIdentifier ? t('regenerate') : t('generate')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </div>

      {selectedItems.length > 0 && (
        <QrPrintGrid restaurantName={restaurantName} logoUrl={logoUrl} items={selectedItems} />
      )}
    </div>
  );
}
