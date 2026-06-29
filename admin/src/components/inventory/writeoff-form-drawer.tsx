'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { useWriteOffsControllerCreate } from '@/api/generated/inventory-write-offs/inventory-write-offs';
import {
  CreateWriteOffDtoReason,
  type CreateWriteOffDto,
  type WriteOffLineDto,
  type InventoryItemResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Field, inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import {
  useMenuItemDetail,
  useMenuItemsForSelect,
  useWriteOffsInvalidation,
} from '@/lib/inventory/use-writeoff-data';
import { unitOptions } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { toast } from '@/stores/toast';

const REASONS = Object.values(CreateWriteOffDtoReason);

interface LineState {
  kind: 'ITEM' | 'DISH';
  itemId: string;
  unit: string;
  qty: string;
  menuItemId: string;
  units: string;
  modifierOptionIds: string[];
}

const itemLine = (): LineState => ({
  kind: 'ITEM',
  itemId: '',
  unit: '',
  qty: '',
  menuItemId: '',
  units: '',
  modifierOptionIds: [],
});
const dishLine = (): LineState => ({ ...itemLine(), kind: 'DISH' });

function nowLocalInput(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** DISH line: menu item + units + modifier-option checkboxes (from the dish). */
function DishLineFields({
  line,
  menuItems,
  onChange,
}: {
  line: LineState;
  menuItems: { id: string; name: string }[];
  onChange: (patch: Partial<LineState>) => void;
}) {
  const t = useTranslations('inventory');
  const { data: detail } = useMenuItemDetail(line.menuItemId || null);
  const options = useMemo(
    () => (detail?.modifierGroups ?? []).flatMap((g) => g.options),
    [detail],
  );
  const toggle = (id: string) =>
    onChange({
      modifierOptionIds: line.modifierOptionIds.includes(id)
        ? line.modifierOptionIds.filter((x) => x !== id)
        : [...line.modifierOptionIds, id],
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('woDish')}>
          <select
            className={inputClass}
            value={line.menuItemId}
            onChange={(e) => onChange({ menuItemId: e.target.value, modifierOptionIds: [] })}
          >
            <option value="">{t('woSelectDish')}</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('woUnits')}>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={line.units}
            onChange={(e) => onChange({ units: e.target.value })}
          />
        </Field>
      </div>
      {options.length > 0 && (
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-600">{t('woMods')}</span>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <label key={o.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={line.modifierOptionIds.includes(o.id)}
                  onChange={() => toggle(o.id)}
                />
                {o.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function WriteOffFormDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const invalidate = useWriteOffsInvalidation();
  const { items } = useItemsForSelect();
  const { menuItems } = useMenuItemsForSelect();

  const [reason, setReason] = useState<string>(CreateWriteOffDtoReason.SPOILAGE);
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState(nowLocalInput());
  const [lines, setLines] = useState<LineState[]>([itemLine()]);
  const [error, setError] = useState<string | undefined>();

  const itemById = useMemo(() => {
    const m = new Map<string, InventoryItemResponse>();
    for (const i of items) m.set(i.id, i);
    return m;
  }, [items]);

  const create = useWriteOffsControllerCreate();
  const submitting = create.isPending;

  const setLine = (i: number, patch: Partial<LineState>) =>
    setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeLine = (i: number) =>
    setLines((rows) => (rows.length === 1 ? rows : rows.filter((_, idx) => idx !== i)));

  const save = async () => {
    setError(undefined);
    const payload: WriteOffLineDto[] = [];
    for (const l of lines) {
      if (l.kind === 'ITEM') {
        const q = Number(l.qty);
        const item = itemById.get(l.itemId);
        if (!l.itemId || !Number.isFinite(q) || q <= 0) continue;
        const unit = l.unit || item?.baseUnit || '';
        payload.push({ kind: 'ITEM', itemId: l.itemId, unit, qty: q });
      } else {
        const u = Number(l.units);
        if (!l.menuItemId || !Number.isFinite(u) || u <= 0) continue;
        payload.push({
          kind: 'DISH',
          menuItemId: l.menuItemId,
          units: u,
          ...(l.modifierOptionIds.length ? { modifierOptionIds: l.modifierOptionIds } : {}),
        });
      }
    }
    if (payload.length === 0) {
      setError(t('woNeedLine'));
      return;
    }
    const data: CreateWriteOffDto = {
      reason: reason as CreateWriteOffDto['reason'],
      note: note.trim() || undefined,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      lines: payload,
    };
    try {
      const res = await create.mutateAsync({ data });
      toast.success(t('woCreated', { cost: formatMoney(res?.totalCost_amount ?? 0, currency) }));
      await invalidate();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Drawer
      open
      title={t('addWriteOff')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {t('woSave')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('woReasonField')} required>
            <select
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`reason${r}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('woOccurredField')}>
            <input
              type="datetime-local"
              className={inputClass}
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('woNoteField')}>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{t('woLines')}</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setLines((r) => [...r, itemLine()])}>
                + {t('woAddItemLine')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setLines((r) => [...r, dishLine()])}>
                + {t('woAddDishLine')}
              </Button>
            </div>
          </div>

          {lines.map((line, i) => {
            const item = line.itemId ? itemById.get(line.itemId) : undefined;
            const units = item ? unitOptions(item.baseUnit, item.alternateUnits) : [];
            return (
              <div key={i} className="space-y-2 rounded-md border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <select
                    className={`${inputClass} w-auto`}
                    value={line.kind}
                    onChange={(e) =>
                      setLine(i, { kind: e.target.value as LineState['kind'] })
                    }
                  >
                    <option value="ITEM">{t('kindITEM')}</option>
                    <option value="DISH">{t('kindDISH')}</option>
                  </select>
                  <Button size="sm" variant="ghost" onClick={() => removeLine(i)}>
                    ×
                  </Button>
                </div>

                {line.kind === 'ITEM' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Field label={t('woItem')}>
                      <select
                        className={inputClass}
                        value={line.itemId}
                        onChange={(e) => setLine(i, { itemId: e.target.value, unit: '' })}
                      >
                        <option value="">{t('woSelectItem')}</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t('woUnit')}>
                      <select
                        className={inputClass}
                        value={line.unit || units[0]?.value || ''}
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
                    <Field label={t('woQty')}>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className={inputClass}
                        value={line.qty}
                        onChange={(e) => setLine(i, { qty: e.target.value })}
                      />
                    </Field>
                  </div>
                ) : (
                  <DishLineFields
                    line={line}
                    menuItems={menuItems}
                    onChange={(patch) => setLine(i, patch)}
                  />
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
