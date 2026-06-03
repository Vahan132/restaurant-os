'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useModifiersControllerAddOptionToGroup,
  useModifiersControllerPatchOption,
} from '@/api/generated/menu-modifiers/menu-modifiers';
import {
  ModifierOptionResponseStatus,
  type ModifierOptionResponse,
  type UpdateModifierOptionDtoStatus,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { minorToInput, toMinor } from '@/lib/money';
import { toast } from '@/stores/toast';

export function ModifierOptionFormModal({
  open,
  groupId,
  option,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  groupId: string;
  option?: ModifierOptionResponse | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const isEdit = !!option;

  const [name, setName] = useState(option?.name ?? '');
  const [price, setPrice] = useState(
    option ? minorToInput(option.priceDeltaAmount, currency) : '0',
  );
  const [displayOrder, setDisplayOrder] = useState(String(option?.displayOrder ?? 0));
  const [status, setStatus] = useState<UpdateModifierOptionDtoStatus>(
    (option?.status as UpdateModifierOptionDtoStatus) ?? ModifierOptionResponseStatus.ACTIVE,
  );
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  const add = useModifiersControllerAddOptionToGroup();
  const patch = useModifiersControllerPatchOption();
  const submitting = add.isPending || patch.isPending;

  const submit = async () => {
    const nextErrors: { name?: string; price?: string } = {};
    if (!name.trim()) nextErrors.name = t('validation.required');
    const priceMinor = toMinor(price, currency);
    if (priceMinor === null) nextErrors.price = t('validation.invalidPrice');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      if (isEdit && option) {
        await patch.mutateAsync({
          id: option.id,
          data: {
            name: name.trim(),
            priceDeltaAmount: priceMinor ?? 0,
            displayOrder: Number(displayOrder) || 0,
            status,
          },
        });
      } else {
        await add.mutateAsync({
          groupId,
          data: {
            name: name.trim(),
            priceDeltaAmount: priceMinor ?? 0,
            displayOrder: Number(displayOrder) || 0,
          },
        });
      }
      toast.success(t('toast.optionSaved'));
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t('optionName') : t('addOption')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {tc('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t('optionName')} required error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={`${t('priceDelta')} (${currency})`} error={errors.price}>
          <input
            inputMode="decimal"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <Field label={t('displayOrder')}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
          />
        </Field>
        {isEdit && (
          <Field label={t('status')}>
            <select
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as UpdateModifierOptionDtoStatus)}
            >
              <option value={ModifierOptionResponseStatus.ACTIVE}>{t('active')}</option>
              <option value={ModifierOptionResponseStatus.INACTIVE}>{t('inactive')}</option>
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
