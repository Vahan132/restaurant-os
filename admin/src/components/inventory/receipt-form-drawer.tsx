'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useGoodsReceiptsControllerCreate } from '@/api/generated/inventory-goods-receipts/inventory-goods-receipts';
import type {
  CreateGoodsReceiptDto,
  CreateGoodsReceiptLineDto,
  InventoryItemResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Field, inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import {
  useInventoryInvalidation,
  useItemsForSelect,
  useSuppliersList,
} from '@/lib/inventory/use-inventory-data';
import {
  BASE_UNIT_ABBR,
  toBaseQty,
  unitOptions,
  type BaseUnit,
} from '@/lib/inventory/units';
import { formatMoney, toMinor } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

interface LineRow {
  itemId: string;
  unit: string;
  qty: string;
  totalCost: string;
  expiryDate: string;
}

const emptyLine = (): LineRow => ({
  itemId: '',
  unit: '',
  qty: '',
  totalCost: '',
  expiryDate: '',
});

function nowLocalInput(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function ReceiptFormDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const invalidate = useInventoryInvalidation();
  const { items } = useItemsForSelect();
  const { suppliers } = useSuppliersList();

  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [receivedAt, setReceivedAt] = useState(nowLocalInput());
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [error, setError] = useState<string | undefined>();

  const itemById = useMemo(() => {
    const map = new Map<string, InventoryItemResponse>();
    for (const i of items) map.set(i.id, i);
    return map;
  }, [items]);

  const create = useGoodsReceiptsControllerCreate();
  const submitting = create.isPending;

  const setLine = (i: number, patch: Partial<LineRow>) =>
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addLine = () => setLines((rows) => [...rows, emptyLine()]);
  const removeLine = (i: number) =>
    setLines((rows) => (rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i)));

  const onSelectLineItem = (i: number, itemId: string) =>
    setLine(i, { itemId, unit: '', expiryDate: '' });

  /** Derived "≈ cost per base unit" preview for a line, or null if not computable. */
  const unitCostPreview = (row: LineRow): string | null => {
    const item = itemById.get(row.itemId);
    if (!item) return null;
    const minor = toMinor(row.totalCost, currency);
    const qtyNum = Number(row.qty);
    if (minor == null || !Number.isFinite(qtyNum) || qtyNum <= 0) return null;
    const unitValue = row.unit || item.baseUnit;
    const baseQty = toBaseQty(qtyNum, unitValue, item.baseUnit, item.alternateUnits);
    if (baseQty <= 0) return null;
    const perBase = minor / baseQty;
    const abbr = BASE_UNIT_ABBR[item.baseUnit as BaseUnit] ?? item.baseUnit;
    return t('rUnitCostPreview', { cost: formatMoney(perBase, currency), unit: abbr });
  };

  const save = async () => {
    setError(undefined);
    const payloadLines: CreateGoodsReceiptLineDto[] = [];
    for (const row of lines) {
      const item = itemById.get(row.itemId);
      if (!item) continue;
      const qtyNum = Number(row.qty);
      const minor = toMinor(row.totalCost, currency);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0 || minor == null) {
        setError(t('needOneLine'));
        return;
      }
      payloadLines.push({
        itemId: row.itemId,
        unit: row.unit || item.baseUnit,
        qty: qtyNum,
        lineTotalCost_amount: minor,
        ...(item.trackExpiry && row.expiryDate ? { expiryDate: row.expiryDate } : {}),
      });
    }
    if (payloadLines.length === 0) {
      setError(t('needOneLine'));
      return;
    }

    const data: CreateGoodsReceiptDto = {
      supplierId: supplierId || undefined,
      reference: reference.trim() || undefined,
      receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
      note: note.trim() || undefined,
      lines: payloadLines,
    };

    try {
      await create.mutateAsync({ data });
      toast.success(t('created'));
      await invalidate();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Drawer
      open
      title={t('addReceipt')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {t('saveReceipt')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('rSupplier')}>
            <select
              className={inputClass}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">{t('noSupplier')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('rReference')}>
            <input
              className={inputClass}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label={t('rReceivedAt')}>
            <input
              type="datetime-local"
              className={inputClass}
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </Field>
          <Field label={t('rNote')}>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{t('rLines')}</h3>
            <Button size="sm" variant="secondary" onClick={addLine}>
              + {t('addLine')}
            </Button>
          </div>

          {lines.map((row, i) => {
            const item = itemById.get(row.itemId);
            const units = item ? unitOptions(item.baseUnit, item.alternateUnits) : [];
            const preview = unitCostPreview(row);
            return (
              <div key={i} className="space-y-2 rounded-md border border-gray-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Field label={t('rItem')}>
                      <select
                        className={inputClass}
                        value={row.itemId}
                        onChange={(e) => onSelectLineItem(i, e.target.value)}
                      >
                        <option value="">{t('selectItem')}</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-6"
                    onClick={() => removeLine(i)}
                  >
                    ×
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Field label={t('rUnit')}>
                    <select
                      className={inputClass}
                      value={row.unit || units[0]?.value || ''}
                      onChange={(e) => setLine(i, { unit: e.target.value })}
                      disabled={!item}
                    >
                      {units.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('rQty')}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={inputClass}
                      value={row.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value })}
                    />
                  </Field>
                  <Field label={t('rLineTotal')}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className={inputClass}
                      value={row.totalCost}
                      onChange={(e) => setLine(i, { totalCost: e.target.value })}
                    />
                  </Field>
                </div>

                <p className="text-xs text-gray-500">{t('rLineTotalHint')}</p>
                {preview && <p className="text-xs font-medium text-gray-600">{preview}</p>}

                {item?.trackExpiry && (
                  <Field label={t('rExpiry')}>
                    <input
                      type="date"
                      className={inputClass}
                      value={row.expiryDate}
                      onChange={(e) => setLine(i, { expiryDate: e.target.value })}
                    />
                  </Field>
                )}
              </div>
            );
          })}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </Drawer>
  );
}
