'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useInventoryLocationsControllerRemove } from '@/api/generated/inventory-locations/inventory-locations';
import type { InventoryLocationResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { LocationFormModal } from '@/components/inventory/location-form-modal';
import {
  LocationStatusBadge,
  LocationTypeBadge,
} from '@/components/inventory/location-shared';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useBranchOnHand,
  useLocations,
  useLocationsInvalidation,
} from '@/lib/inventory/use-locations-data';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

export function LocationsManager() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.INVENTORY_LOCATION_MANAGE);
  const invalidate = useLocationsInvalidation();
  const { ask, dialog } = useConfirm();

  const { locations, isLoading, isError } = useLocations();
  const { rows } = useBranchOnHand();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryLocationResponse | null>(null);

  // Location ids that currently hold non-zero stock (blocks deletion client-side).
  const occupied = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.quantity !== 0) set.add(r.locationId);
    return set;
  }, [rows]);

  const remove = useInventoryLocationsControllerRemove();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openRename = (loc: InventoryLocationResponse) => {
    setEditing(loc);
    setFormOpen(true);
  };

  const onDelete = async (loc: InventoryLocationResponse) => {
    if (loc.isSystem) {
      toast.error(t('locDeleteSystemBlocked'));
      return;
    }
    if (occupied.has(loc.id)) {
      toast.error(t('locDeleteNotEmpty'));
      return;
    }
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteLocation', { name: loc.name }),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: loc.id });
      toast.success(t('deleted'));
      await invalidate();
    } catch (err) {
      // Surface the backend's block (e.g. not empty / system) verbatim.
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('locationsTitle')}</h1>
        {canManage && (
          <Button variant="primary" onClick={openCreate}>
            + {t('addLocation')}
          </Button>
        )}
      </div>

      <p className="text-sm text-gray-500">{t('locationsIntro')}</p>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : locations.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noLocations')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('locName')}</th>
                <th className="px-4 py-2 font-medium">{t('locType')}</th>
                <th className="px-4 py-2 font-medium">{t('locStatus')}</th>
                <th className="px-4 py-2 font-medium">{t('locContents')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => {
                const hasStock = occupied.has(loc.id);
                const canDelete = canManage && !loc.isSystem && !hasStock;
                const canRename = canManage && !loc.isSystem;
                return (
                  <tr key={loc.id} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-800">
                      {loc.name}
                      {loc.isDefault && (
                        <span className="ml-2 text-xs text-gray-400">{t('locDefault')}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <LocationTypeBadge systemType={loc.systemType} />
                    </td>
                    <td className="px-4 py-2">
                      <LocationStatusBadge status={loc.status} />
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {hasStock ? t('locHasStock') : t('locEmpty')}
                    </td>
                    <td className="px-4 py-2">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openRename(loc)}
                            disabled={!canRename}
                            title={canRename ? undefined : t('locSystemReadonly')}
                          >
                            {tc('edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(loc)}
                            disabled={!canDelete}
                            title={
                              loc.isSystem
                                ? t('locDeleteSystemBlocked')
                                : hasStock
                                  ? t('locDeleteNotEmpty')
                                  : undefined
                            }
                          >
                            {tc('delete')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <LocationFormModal location={editing} onClose={() => setFormOpen(false)} />
      )}
      {dialog}
    </div>
  );
}
