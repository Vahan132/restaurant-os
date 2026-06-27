'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  useProcessesControllerCreate,
  useProcessesControllerUpdate,
} from '@/api/generated/inventory-processes/inventory-processes';
import type {
  CreateProcessDto,
  CreateProcessInputDto,
  CreateProcessOutputDto,
  InventoryItemResponse,
  UpdateProcessDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Field, inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import {
  usePaginatedItems,
  useItemsForSelect,
} from '@/lib/inventory/use-inventory-data';
import {
  useProcess,
  useProcessesInvalidation,
  useUnitCostMap,
} from '@/lib/inventory/use-process-data';
import { BASE_UNIT_ABBR, type BaseUnit } from '@/lib/inventory/units';
import { formatMoney, minorToInput, toMinor } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

interface InputRow {
  itemId: string;
  baseQty: string;
}
interface OutputRow {
  itemId: string;
  baseQty: string;
  isPrimary: boolean;
  costShare: string;
}

const emptyInput = (): InputRow => ({ itemId: '', baseQty: '' });
const emptyOutput = (): OutputRow => ({
  itemId: '',
  baseQty: '',
  isPrimary: false,
  costShare: '',
});

export function ProcessFormDrawer({
  processId,
  onClose,
}: {
  processId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const invalidate = useProcessesInvalidation();
  const isEdit = !!processId;

  const { data: existing, isLoading: loadingExisting } = useProcess(processId);
  const { items: allItems } = useItemsForSelect();
  const { items: processedItems } = usePaginatedItems({ limit: 100, kind: 'PROCESSED' });
  const { unitCost } = useUnitCostMap();

  const [name, setName] = useState('');
  const [processingCost, setProcessingCost] = useState('');
  const [note, setNote] = useState('');
  const [inputs, setInputs] = useState<InputRow[]>([emptyInput()]);
  const [outputs, setOutputs] = useState<OutputRow[]>([emptyOutput()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Initialize form from the loaded process (edit) once.
  useEffect(() => {
    if (!isEdit || hydrated || !existing) return;
    setName(existing.name);
    setProcessingCost(minorToInput(existing.processingCost, currency));
    setNote(existing.note ?? '');
    setInputs(
      existing.inputs.length
        ? existing.inputs.map((i) => ({ itemId: i.itemId, baseQty: String(i.baseQty) }))
        : [emptyInput()],
    );
    setOutputs(
      existing.outputs.length
        ? existing.outputs.map((o) => ({
            itemId: o.itemId,
            baseQty: String(o.baseQty),
            isPrimary: o.isPrimary,
            costShare: o.costShareBps != null ? String(o.costShareBps) : '',
          }))
        : [emptyOutput()],
    );
    setHydrated(true);
  }, [isEdit, hydrated, existing, currency]);

  const itemById = useMemo(() => {
    const m = new Map<string, InventoryItemResponse>();
    for (const i of allItems) m.set(i.id, i);
    for (const i of processedItems) m.set(i.id, i);
    return m;
  }, [allItems, processedItems]);

  const create = useProcessesControllerCreate();
  const update = useProcessesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const unitLabel = (itemId: string) => {
    const it = itemById.get(itemId);
    return it ? (BASE_UNIT_ABBR[it.baseUnit as BaseUnit] ?? it.baseUnit) : '';
  };

  // --- repeatable row helpers ---
  const setInput = (i: number, patch: Partial<InputRow>) =>
    setInputs((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setOutput = (i: number, patch: Partial<OutputRow>) =>
    setOutputs((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setPrimary = (i: number) =>
    setOutputs((rows) => rows.map((r, idx) => ({ ...r, isPrimary: idx === i })));

  // --- cost previews (informational) ---
  const processingMinor = toMinor(processingCost, currency) ?? 0;
  const inputsCost = useMemo(
    () =>
      inputs.reduce((sum, r) => {
        const q = Number(r.baseQty);
        return sum + (Number.isFinite(q) ? q * unitCost(r.itemId) : 0);
      }, 0),
    [inputs, unitCost],
  );
  const estBatchCost = inputsCost + processingMinor;

  /** Allocation of estimated total across outputs (matches backend rules). */
  const allocation = useMemo(() => {
    const shares = outputs.map((o) => (o.costShare.trim() === '' ? null : Number(o.costShare)));
    const allShared = shares.length > 0 && shares.every((s) => s != null);
    return outputs.map((o, i) => {
      if (allShared) return (estBatchCost * (shares[i] as number)) / 10000;
      return o.isPrimary ? estBatchCost : 0;
    });
  }, [outputs, estBatchCost]);

  const validate = (): {
    ok: boolean;
    inputsDto: CreateProcessInputDto[];
    outputsDto: CreateProcessOutputDto[];
  } => {
    const errs: string[] = [];

    const inputsDto: CreateProcessInputDto[] = [];
    for (const r of inputs) {
      const q = Number(r.baseQty);
      if (!r.itemId || !Number.isFinite(q) || q <= 0) continue;
      inputsDto.push({ itemId: r.itemId, baseQty: q });
    }
    if (inputsDto.length === 0) errs.push(t('needInput'));

    const filledOut = outputs.filter((o) => o.itemId || o.baseQty.trim() !== '');
    const outputsDto: CreateProcessOutputDto[] = [];
    let badOutput = false;
    for (const o of filledOut) {
      const q = Number(o.baseQty);
      if (!o.itemId || !Number.isFinite(q) || q <= 0) {
        badOutput = true;
        continue;
      }
      // Outputs must be PROCESSED.
      const it = itemById.get(o.itemId);
      if (it && it.kind !== 'PROCESSED') {
        errs.push(t('outputsMustBeProcessed'));
        continue;
      }
      const dto: CreateProcessOutputDto = { itemId: o.itemId, baseQty: q, isPrimary: o.isPrimary };
      if (o.costShare.trim() !== '') dto.costShareBps = Number(o.costShare);
      outputsDto.push(dto);
    }
    if (outputsDto.length === 0 || badOutput) errs.push(t('needOutput'));

    // Cost-share all-or-none + sum to 10000, else exactly one primary.
    if (outputsDto.length > 0) {
      const withShare = outputsDto.filter((o) => o.costShareBps != null);
      if (withShare.length > 0) {
        const sum = withShare.reduce((s, o) => s + (o.costShareBps ?? 0), 0);
        if (withShare.length !== outputsDto.length || sum !== 10000) {
          errs.push(t('costShareAllOrNone'));
        }
      } else {
        const primaries = outputsDto.filter((o) => o.isPrimary).length;
        if (primaries !== 1) errs.push(t('needPrimary'));
      }
    }

    setErrors(Array.from(new Set(errs)));
    return { ok: errs.length === 0, inputsDto, outputsDto };
  };

  const save = async () => {
    const { ok, inputsDto, outputsDto } = validate();
    if (!ok) return;
    if (!name.trim()) {
      setErrors((e) => Array.from(new Set([...e, t('validName')])));
      return;
    }
    try {
      if (isEdit && processId) {
        const data: UpdateProcessDto = {
          name: name.trim(),
          processingCost_amount: processingMinor,
          note: note.trim() || undefined,
          inputs: inputsDto,
          outputs: outputsDto,
        };
        await update.mutateAsync({ id: processId, data });
        toast.success(t('updated'));
        await invalidate(processId);
      } else {
        const data: CreateProcessDto = {
          name: name.trim(),
          processingCost_amount: processingMinor,
          note: note.trim() || undefined,
          inputs: inputsDto,
          outputs: outputsDto,
        };
        await create.mutateAsync({ data });
        toast.success(t('created'));
        await invalidate();
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const showSkeleton = isEdit && loadingExisting && !hydrated;

  return (
    <Drawer
      open
      title={isEdit ? t('editProcess') : t('addProcess')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting || showSkeleton}>
            {isEdit ? tc('save') : tc('create')}
          </Button>
        </>
      }
    >
      {showSkeleton ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <Field label={t('pName')} required>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label={t('pProcessingCost')}>
            <input
              type="number"
              min={0}
              step="any"
              className={inputClass}
              value={processingCost}
              onChange={(e) => setProcessingCost(e.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500">{t('pProcessingCostHint')}</span>
          </Field>
          <Field label={t('pNote')}>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {/* Inputs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{t('pInputs')}</h3>
              <Button size="sm" variant="secondary" onClick={() => setInputs((r) => [...r, emptyInput()])}>
                + {t('pAddInput')}
              </Button>
            </div>
            {inputs.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <select
                    className={inputClass}
                    value={row.itemId}
                    onChange={(e) => setInput(i, { itemId: e.target.value })}
                  >
                    <option value="">{t('pSelectItem')}</option>
                    {allItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={inputClass}
                      placeholder={t('pBaseQty')}
                      value={row.baseQty}
                      onChange={(e) => setInput(i, { baseQty: e.target.value })}
                    />
                    <span className="text-xs text-gray-500">{unitLabel(row.itemId)}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setInputs((r) => (r.length === 1 ? r : r.filter((_, idx) => idx !== i)))}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>

          {/* Outputs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{t('pOutputs')}</h3>
              <Button size="sm" variant="secondary" onClick={() => setOutputs((r) => [...r, emptyOutput()])}>
                + {t('pAddOutput')}
              </Button>
            </div>
            {outputs.map((row, i) => (
              <div key={i} className="space-y-2 rounded-md border border-gray-200 p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <select
                      className={inputClass}
                      value={row.itemId}
                      onChange={(e) => setOutput(i, { itemId: e.target.value })}
                    >
                      <option value="">{t('pSelectItem')}</option>
                      {processedItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-40">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={inputClass}
                        placeholder={t('pBaseQty')}
                        value={row.baseQty}
                        onChange={(e) => setOutput(i, { baseQty: e.target.value })}
                      />
                      <span className="text-xs text-gray-500">{unitLabel(row.itemId)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOutputs((r) => (r.length === 1 ? r : r.filter((_, idx) => idx !== i)))}
                  >
                    ×
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="primary-output"
                      checked={row.isPrimary}
                      onChange={() => setPrimary(i)}
                    />
                    {t('pIsPrimary')}
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700">
                    <span>{t('pCostShare')}</span>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      className={`${inputClass} w-28`}
                      value={row.costShare}
                      onChange={(e) => setOutput(i, { costShare: e.target.value })}
                    />
                  </label>
                  <span className="ml-auto text-xs text-gray-500">
                    {formatMoney(allocation[i] ?? 0, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Cost allocation + estimated batch cost helpers */}
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">{t('estBatchCost')}</span>
              <span className="text-gray-900">{formatMoney(estBatchCost, currency)}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{t('estBatchCostHint')}</p>
            <div className="mt-2 border-t border-gray-200 pt-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('costAllocation')}
              </span>
              <ul className="mt-1 space-y-0.5">
                {outputs.map((o, i) => {
                  const it = o.itemId ? itemById.get(o.itemId) : null;
                  if (!it) return null;
                  return (
                    <li key={i} className="flex justify-between text-gray-600">
                      <span>
                        {it.name}
                        {o.isPrimary && o.costShare.trim() === '' && (
                          <span className="text-gray-400"> · {t('allocPrimaryRemainder')}</span>
                        )}
                      </span>
                      <span>{formatMoney(allocation[i] ?? 0, currency)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((e) => (
                <p key={e} className="text-xs text-red-600">
                  {e}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
