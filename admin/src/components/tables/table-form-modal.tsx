'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useTablesControllerCreate,
  useTablesControllerUpdate,
} from '@/api/generated/tables/tables';
import type { FloorResponse, TableResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useTablesInvalidation } from '@/lib/tables/use-tables-data';
import { toast } from '@/stores/toast';

export function TableFormModal({
  open,
  table,
  floors,
  defaultFloorId,
  onClose,
}: {
  open: boolean;
  table?: TableResponse | null;
  floors: FloorResponse[];
  defaultFloorId: string;
  onClose: () => void;
}) {
  const t = useTranslations('tables');
  const tc = useTranslations('common');
  const invalidate = useTablesInvalidation();
  const isEdit = !!table;

  const [name, setName] = useState(table?.name ?? '');
  const [floorId, setFloorId] = useState(table?.floorId ?? defaultFloorId);
  const [seatCapacity, setSeatCapacity] = useState(String(table?.seatCapacity ?? 2));
  const [qrIdentifier, setQrIdentifier] = useState(table?.qrIdentifier ?? '');
  const [errors, setErrors] = useState<{ name?: string; seats?: string }>({});

  const create = useTablesControllerCreate();
  const update = useTablesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const submit = async () => {
    const next: { name?: string; seats?: string } = {};
    if (!name.trim()) next.name = t('validation.required');
    const seats = Number(seatCapacity);
    if (!Number.isInteger(seats) || seats < 1) next.seats = t('validation.minSeats');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      if (isEdit && table) {
        await update.mutateAsync({
          id: table.id,
          data: {
            name: name.trim(),
            floorId,
            seatCapacity: seats,
            qrIdentifier: qrIdentifier.trim() || undefined,
          },
        });
        toast.success(t('toast.tableUpdated'));
      } else {
        await create.mutateAsync({
          data: {
            name: name.trim(),
            floorId,
            seatCapacity: seats,
            qrIdentifier: qrIdentifier.trim() || undefined,
          },
        });
        toast.success(t('toast.tableCreated'));
      }
      await invalidate();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t('editTable') : t('addTable')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {isEdit ? tc('save') : tc('create')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('tableName')} required error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('floor')}>
            <select
              className={inputClass}
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
            >
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('seatCapacity')} required error={errors.seats}>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={seatCapacity}
              onChange={(e) => setSeatCapacity(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('qrIdentifier')}>
          <input
            className={inputClass}
            value={qrIdentifier}
            onChange={(e) => setQrIdentifier(e.target.value)}
          />
          <span className="mt-1 block text-xs text-gray-500">{t('qrHint')}</span>
        </Field>
      </div>
    </Modal>
  );
}
