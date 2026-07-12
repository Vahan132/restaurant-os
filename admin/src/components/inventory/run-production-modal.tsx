'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useProcessesControllerRun } from '@/api/generated/inventory-processes/inventory-processes';
import type { RunProcessDto } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { itemDisplayName } from '@/lib/inventory/display-name';
import { useInventoryInvalidation, useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import {
  useProcess,
  useRunsInvalidation,
  useUnitCostMap,
} from '@/lib/inventory/use-process-data';
import { BASE_UNIT_ABBR, formatNumber, type BaseUnit } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

function nowLocalInput(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function RunProductionModal({
  processId,
  onClose,
}: {
  processId: string;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const { data: process, isLoading } = useProcess(processId);
  const { unitCost } = useUnitCostMap();
  const { items } = useItemsForSelect();
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const itemName = (id: string) => {
    const it = itemById.get(id);
    return it ? itemDisplayName(it, locale) : id;
  };
  const itemUnit = (id: string) => abbr(itemById.get(id)?.baseUnit ?? '');
  const invalidateInventory = useInventoryInvalidation();
  const invalidateRuns = useRunsInvalidation();

  const [multiplier, setMultiplier] = useState('1');
  const [runAt, setRunAt] = useState(nowLocalInput());
  const [note, setNote] = useState('');
  const [expiry, setExpiry] = useState<Record<string, string>>({});

  const run = useProcessesControllerRun();
  const submitting = run.isPending;

  const mult = Math.max(1, Math.floor(Number(multiplier) || 1));
  const abbr = (u: string) => BASE_UNIT_ABBR[u as BaseUnit] ?? u;

  const estTotal = useMemo(() => {
    if (!process) return 0;
    const inputs = process.inputs.reduce(
      (s, i) => s + i.baseQty * mult * unitCost(i.itemId),
      0,
    );
    return inputs + process.processingCost_amount;
  }, [process, mult, unitCost]);

  const expiryOutputs = useMemo(
    () => (process?.outputs ?? []).filter((o) => itemById.get(o.itemId)?.trackExpiry),
    [process, itemById],
  );

  const submit = async () => {
    if (!process) return;
    const outputExpiry = Object.entries(expiry)
      .filter(([, v]) => v)
      .map(([itemId, expiryDate]) => ({ itemId, expiryDate }));

    const data: RunProcessDto = {
      multiplier: mult,
      runAt: runAt ? new Date(runAt).toISOString() : undefined,
      note: note.trim() || undefined,
      ...(outputExpiry.length ? { outputExpiry } : {}),
    };
    try {
      const result = await run.mutateAsync({ id: processId, data });
      const summary = process.outputs
        .map((o) => `${formatNumber(o.baseQty * mult)} ${itemName(o.itemId)}`)
        .join(', ');
      toast.success(
        t('runSuccess', {
          outputs: summary || String(process.outputs.length),
          cost: formatMoney(result?.totalCost_amount ?? 0, currency),
        }),
      );
      if (result?.wentNegative) toast.error(t('runWentNegative'));
      await Promise.all([invalidateRuns(), invalidateInventory()]);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      title={process ? t('runTitle', { name: process.name }) : t('runProduction')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting || !process}>
            {t('runSubmit')}
          </Button>
        </>
      }
    >
      {isLoading || !process ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('runMultiplier')} required>
              <input
                type="number"
                min={1}
                step={1}
                className={inputClass}
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={t('runAtLabel')}>
              <input
                type="datetime-local"
                className={inputClass}
                value={runAt}
                onChange={(e) => setRunAt(e.target.value)}
              />
            </Field>
          </div>

          <Field label={t('runNote')}>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {expiryOutputs.length > 0 && (
            <div className="space-y-2">
              {expiryOutputs.map((o) => (
                <Field key={o.itemId} label={t('runExpiryFor', { item: itemName(o.itemId) })}>
                  <input
                    type="date"
                    className={inputClass}
                    value={expiry[o.itemId] ?? ''}
                    onChange={(e) =>
                      setExpiry((prev) => ({ ...prev, [o.itemId]: e.target.value }))
                    }
                  />
                </Field>
              ))}
            </div>
          )}

          {/* Live preview */}
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('runConsumes')}
            </span>
            <ul className="mt-1 space-y-0.5">
              {process.inputs.map((i) => (
                <li key={i.itemId} className="flex justify-between text-gray-600">
                  <span>{itemName(i.itemId)}</span>
                  <span>
                    {formatNumber(i.baseQty * mult)} {itemUnit(i.itemId)}
                  </span>
                </li>
              ))}
            </ul>
            <span className="mt-2 block text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('runProduces')}
            </span>
            <ul className="mt-1 space-y-0.5">
              {process.outputs.map((o) => (
                <li key={o.itemId} className="flex justify-between text-gray-600">
                  <span>{itemName(o.itemId)}</span>
                  <span>
                    {formatNumber(o.baseQty * mult)} {itemUnit(o.itemId)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-medium text-gray-800">
              <span>{t('runEstTotal')}</span>
              <span>{formatMoney(estTotal, currency)}</span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
