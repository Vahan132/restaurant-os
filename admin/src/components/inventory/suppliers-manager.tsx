'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useInventorySuppliersControllerRemove } from '@/api/generated/inventory-suppliers/inventory-suppliers';
import type { SupplierResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { Pagination } from '@/components/inventory/shared';
import { SupplierFormModal } from '@/components/inventory/supplier-form-modal';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useSuppliersInvalidation,
  useSuppliersList,
} from '@/lib/inventory/use-inventory-data';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

const PAGE_SIZE = 20;

export function SuppliersManager() {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const canManage = usePermission(PERMISSIONS.INVENTORY_ITEM_MANAGE);
  const invalidate = useSuppliersInvalidation();
  const { ask, dialog } = useConfirm();

  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierResponse | null>(null);

  const params = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const { suppliers, pagination, isLoading, isFetching, isError } = useSuppliersList(params);
  const hasNext = pagination?.hasNext ?? suppliers.length === PAGE_SIZE;

  const remove = useInventorySuppliersControllerRemove();

  const onDelete = async (supplier: SupplierResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteSupplier'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: supplier.id });
      toast.success(t('deleted'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('suppliersTitle')}</h1>
        {canManage && (
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            + {t('addSupplier')}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('loadError')}</p>
        ) : suppliers.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noSuppliers')}</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('sName')}</th>
                <th className="px-4 py-2 font-medium">{t('colContact')}</th>
                <th className="px-4 py-2 font-medium">{t('colNoteOnly')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-gray-100">
                  <td className="px-4 py-2 font-medium text-gray-800">{supplier.name}</td>
                  <td className="px-4 py-2 text-gray-600">{supplier.contact ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{supplier.note ?? '—'}</td>
                  <td className="px-4 py-2">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditing(supplier);
                            setFormOpen(true);
                          }}
                        >
                          {tc('edit')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(supplier)}>
                          {tc('delete')}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        page={page}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => p + 1)}
        hasNext={hasNext}
        isFetching={isFetching}
      />

      {formOpen && (
        <SupplierFormModal supplier={editing} onClose={() => setFormOpen(false)} />
      )}
      {dialog}
    </div>
  );
}
