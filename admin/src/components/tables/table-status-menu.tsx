'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useTablesControllerChangeStatus } from '@/api/generated/tables/tables';
import type { ChangeTableStatusDtoStatus, TableResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { isApiError, getErrorMessage } from '@/lib/api-error';
import { getTransitionOptions, type TableStatus } from '@/lib/tables/transitions';
import { toast } from '@/stores/toast';

export function TableStatusMenu({
  table,
  allowManual,
  onChanged,
}: {
  table: TableResponse;
  allowManual: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations('tables');
  const [open, setOpen] = useState(false);
  const changeStatus = useTablesControllerChangeStatus();

  const options = getTransitionOptions(table.status as TableStatus, allowManual);

  const apply = async (to: TableStatus) => {
    setOpen(false);
    try {
      await changeStatus.mutateAsync({
        id: table.id,
        data: { status: to as ChangeTableStatusDtoStatus },
      });
      toast.success(t('toast.statusUpdated'));
      await onChanged();
    } catch (err) {
      // Backend rejects flow-driven changes when manual status is disabled.
      if (isApiError(err) && err.code === 'MANUAL_TABLE_STATUS_DISABLED') {
        toast.error(t('manualDisabledError'));
      } else {
        toast.error(getErrorMessage(err));
      }
    }
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        disabled={changeStatus.isPending}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('changeStatus')}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            {options.map((opt) => (
              <button
                key={opt.to}
                type="button"
                role="menuitem"
                disabled={!opt.enabled}
                title={!opt.enabled ? t('manualDisabledTooltip') : undefined}
                onClick={() => opt.enabled && apply(opt.to)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                <span>{t(`status.${opt.to}`)}</span>
                {!opt.enabled && <span className="text-xs">🔒</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
