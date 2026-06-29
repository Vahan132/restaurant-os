'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useModifierGroupsControllerAddOptionToGroup,
  useModifierGroupsControllerPatchOption,
} from '@/api/generated/menu-modifier-groups/menu-modifier-groups';
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

/**
 * Create or edit a single option inside a library modifier group. Prices are
 * entered in major units and converted to integer minor units before sending.
 */
export function ModifierOptionFormModal({
  open,
  groupId,
  option,
  currency,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  groupId: string;
  option?: ModifierOptionResponse | null;
  currency: string;
  /** Default sortOrder for a brand-new option (append to the end). */
  nextSortOrder?: number;
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
  const [isDefault, setIsDefault] = useState(option?.isDefault ?? false);
  const [status, setStatus] = useState<UpdateModifierOptionDtoStatus>(
    (option?.status as UpdateModifierOptionDtoStatus) ?? ModifierOptionResponseStatus.ACTIVE,
  );
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});

  const add = useModifierGroupsControllerAddOptionToGroup();
  const patch = useModifierGroupsControllerPatchOption();
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
          groupId,
          optionId: option.id,
          data: {
            name: name.trim(),
            priceDeltaAmount: priceMinor ?? 0,
            isDefault,
            status,
          },
        });
      } else {
        await add.mutateAsync({
          groupId,
          data: {
            name: name.trim(),
            priceDeltaAmount: priceMinor ?? 0,
            isDefault,
            sortOrder: nextSortOrder ?? 0,
          },
        });
      }
      toast.success(t('toast.optionSaved'));
      await onSaved();
      onClose();
    } catch (err) {
      setErrors({ name: getErrorMessage(err) });
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
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label={`${t('priceDelta')} (${currency})`} error={errors.price}>
          <input
            inputMode="decimal"
            className={inputClass}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          {t('isDefault')}
        </label>
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
