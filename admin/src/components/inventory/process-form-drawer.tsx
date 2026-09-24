'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  useProcessesControllerCreate,
  useProcessesControllerUpdate,
} from '@/api/generated/inventory-processes/inventory-processes';
import type {
  CreateProcessDto,
  ProcessInputDto,
  ProcessOutputDto,
  InventoryItemResponse,
  UpdateProcessDto,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Field, inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { itemDisplayName } from '@/lib/inventory/display-name';
import {
  usePaginatedItems,
  useItemsForSelect,
} from '@/lib/inventory/use-inventory-data';
import {
  useProcess,
  useProcessesInvalidation,
  useUnitCostMap,
} from '@/lib/inventory/use-process-data';
import { ProcessCalculationPanel } from '@/components/inventory/process-calculation-panel';
import { factorForUnit, unitOptions } from '@/lib/inventory/units';
import { formatMoney, minorToInput, toMinor } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

/** `baseQty` holds the quantity as typed, in `unit` ('' = the item's base unit). */
interface InputRow {
  itemId: string;
  baseQty: string;
  unit: string;
}
interface OutputRow {
  itemId: string;
  baseQty: string;
  unit: string;
  isPrimary: boolean;
  costShare: string;
}

const emptyInput = (): InputRow => ({ itemId: '', baseQty: '', unit: '' });
const emptyOutput = (): OutputRow => ({
  itemId: '',
  baseQty: '',
  unit: '',
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
  const locale = useLocale();
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
    setProcessingCost(minorToInput(existing.processingCost_amount, currency));
    setNote(existing.note ?? '');
    setInputs(
      existing.inputs.length
        ? existing.inputs.map((i) => ({ itemId: i.itemId, baseQty: String(i.baseQty), unit: '' }))
        : [emptyInput()],
    );
    setOutputs(
      existing.outputs.length
        ? existing.outputs.map((o) => ({
            itemId: o.itemId,
            baseQty: String(o.baseQty),
            unit: '',
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

  /** Unit choices for a row: the item's base unit + its alternate units (kg, L, box…). */
  const unitChoices = (itemId: string) => {
    const it = itemById.get(itemId);
    return it ? unitOptions(it.baseUnit, it.alternateUnits) : [];
  };
  /** Typed qty converted to the item's base unit (NaN when not a number). */
  const toBase = (itemId: string, qty: string, unit: string): number => {
    const it = itemById.get(itemId);
    const q = Number(qty);
    if (!it || qty.trim() === '' || !Number.isFinite(q)) return NaN;
    return q * factorForUnit(unit || it.baseUnit, it.baseUnit, it.alternateUnits);
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

  // Live "how it's calculated" model, in base units (matches backend rules).
  const calcInputs = useMemo(
    () =>
      inputs.map((r) => {
        const b = toBase(r.itemId, r.baseQty, r.unit);
        return { itemId: r.itemId, baseQty: Number.isFinite(b) ? b : 0 };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs, itemById],
  );
  const calcOutputs = useMemo(
    () =>
      outputs.map((o) => {
        const b = toBase(o.itemId, o.baseQty, o.unit);
        return {
          itemId: o.itemId,
          baseQty: Number.isFinite(b) ? b : 0,
          isPrimary: o.isPrimary,
          costShareBps: o.costShare.trim() === '' ? null : Number(o.costShare),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outputs, itemById],
  );
  const estBatchCost =
    calcInputs.reduce((s, i) => s + i.baseQty * unitCost(i.itemId), 0) + processingMinor;

  /** Allocation of estimated total across outputs (matches backend rules). */
  const allocation = useMemo(() => {
    const allShared = calcOutputs.length > 0 && calcOutputs.every((o) => o.costShareBps != null);
    return calcOutputs.map((o) => {
      if (allShared) return (estBatchCost * (o.costShareBps as number)) / 10000;
      return o.isPrimary ? estBatchCost : 0;
    });
  }, [calcOutputs, estBatchCost]);

  const validate = (): {
    ok: boolean;
    inputsDto: ProcessInputDto[];
    outputsDto: ProcessOutputDto[];
  } => {
    const errs: string[] = [];

    const inputsDto: ProcessInputDto[] = [];
    for (const r of inputs) {
      const q = toBase(r.itemId, r.baseQty, r.unit);
      if (!r.itemId || !Number.isFinite(q) || q <= 0) continue;
      // Quantities are stored as whole base units (g / ml / pc).
      if (!Number.isInteger(Math.round(q * 1e6) / 1e6)) {
        errs.push(t('calcQtyNotInteger'));
        continue;
      }
      inputsDto.push({ itemId: r.itemId, baseQty: Math.round(q) });
    }
    if (inputsDto.length === 0) errs.push(t('needInput'));

    const filledOut = outputs.filter((o) => o.itemId || o.baseQty.trim() !== '');
    const outputsDto: ProcessOutputDto[] = [];
    let badOutput = false;
    for (const o of filledOut) {
      const q = toBase(o.itemId, o.baseQty, o.unit);
      if (!o.itemId || !Number.isFinite(q) || q <= 0) {
        badOutput = true;
        continue;
      }
      if (!Number.isInteger(Math.round(q * 1e6) / 1e6)) {
        errs.push(t('calcQtyNotInteger'));
        continue;
      }
      // Outputs must be PROCESSED.
      const it = itemById.get(o.itemId);
      if (it && it.kind !== 'PROCESSED') {
        errs.push(t('outputsMustBeProcessed'));
        continue;
      }
      const dto: ProcessOutputDto = {
        itemId: o.itemId,
        baseQty: Math.round(q),
        isPrimary: o.isPrimary,
      };
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
                    onChange={(e) => setInput(i, { itemId: e.target.value, unit: '' })}
                  >
                    <option value="">{t('pSelectItem')}</option>
                    {allItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {itemDisplayName(it, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-48">
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
                    <UnitSelect
                      options={unitChoices(row.itemId)}
                      value={row.unit}
                      onChange={(unit) => setInput(i, { unit })}
                    />
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
                      onChange={(e) => setOutput(i, { itemId: e.target.value, unit: '' })}
                    >
                      <option value="">{t('pSelectItem')}</option>
                      {processedItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {itemDisplayName(it, locale)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-48">
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
                      <UnitSelect
                        options={unitChoices(row.itemId)}
                        value={row.unit}
                        onChange={(unit) => setOutput(i, { unit })}
                      />
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

          {/* How the ins and outs are calculated (conversions, yield, unit cost). */}
          <ProcessCalculationPanel
            inputs={calcInputs}
            outputs={calcOutputs}
            processingCost={processingMinor}
            itemById={itemById}
            unitCost={unitCost}
            currency={currency}
          />

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

/** Compact unit picker (base unit + alternates); a plain label when there is only one. */
function UnitSelect({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string; isBase: boolean }>;
  value: string;
  onChange: (unit: string) => void;
}) {
  const first = options[0];
  if (!first) return <span className="w-12" />;
  if (options.length === 1) {
    return <span className="w-12 text-xs text-gray-500">{first.label}</span>;
  }
  const current = value || first.value;
  return (
    <select
      className="w-16 rounded-md border border-gray-300 bg-white px-1 py-1.5 text-xs text-gray-700"
      value={current}
      onChange={(e) => onChange(e.target.value === first.value ? '' : e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
