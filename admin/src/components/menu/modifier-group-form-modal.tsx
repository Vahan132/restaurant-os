'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useItemsControllerAddModifierGroup } from '@/api/generated/menu-items/menu-items';
import { useModifiersControllerPatchGroup } from '@/api/generated/menu-modifiers/menu-modifiers';
import {
  CreateModifierGroupDtoSelectionType,
  ModifierGroupResponseSelectionType,
  type ModifierGroupWithOptionsResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from '@/stores/toast';

type SelectionType = CreateModifierGroupDtoSelectionType;

export function ModifierGroupFormModal({
  open,
  itemId,
  group,
  optionCount,
  onClose,
  onSaved,
}: {
  open: boolean;
  itemId: string;
  group?: ModifierGroupWithOptionsResponse | null;
  optionCount: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const isEdit = !!group;

  const [name, setName] = useState(group?.name ?? '');
  const [selectionType, setSelectionType] = useState<SelectionType>(
    (group?.selectionType as SelectionType) ?? CreateModifierGroupDtoSelectionType.SINGLE,
  );
  const [required, setRequired] = useState(group?.required ?? false);
  const [minSelect, setMinSelect] = useState(group?.minSelect != null ? String(group.minSelect) : '');
  const [maxSelect, setMaxSelect] = useState(group?.maxSelect != null ? String(group.maxSelect) : '');
  const [displayOrder, setDisplayOrder] = useState(String(group?.displayOrder ?? 0));
  const [error, setError] = useState<string>();

  const add = useItemsControllerAddModifierGroup();
  const patch = useModifiersControllerPatchGroup();
  const submitting = add.isPending || patch.isPending;
  const isMultiple = selectionType === ModifierGroupResponseSelectionType.MULTIPLE;

  const submit = async () => {
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    const min = minSelect === '' ? undefined : Number(minSelect);
    const max = maxSelect === '' ? undefined : Number(maxSelect);
    if (isMultiple && min != null && max != null && min > max) {
      setError(t('validation.minMax'));
      return;
    }
    if (isMultiple && max != null && optionCount > 0 && max > optionCount) {
      setError(t('validation.maxOptions'));
      return;
    }
    setError(undefined);

    const data = {
      name: name.trim(),
      selectionType,
      required,
      displayOrder: Number(displayOrder) || 0,
      // min/max are only meaningful for MULTIPLE.
      minSelect: isMultiple ? min : undefined,
      maxSelect: isMultiple ? max : undefined,
    };

    try {
      if (isEdit && group) {
        await patch.mutateAsync({ id: group.id, data });
      } else {
        await add.mutateAsync({ itemId, data });
      }
      toast.success(t('toast.groupSaved'));
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t('groupName') : t('addGroup')}
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
        <Field label={t('groupName')} required error={error}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('selectionType')}>
          <select
            className={inputClass}
            value={selectionType}
            onChange={(e) => setSelectionType(e.target.value as SelectionType)}
          >
            <option value={CreateModifierGroupDtoSelectionType.SINGLE}>{t('single')}</option>
            <option value={CreateModifierGroupDtoSelectionType.MULTIPLE}>{t('multiple')}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          {t('required')}
        </label>
        {isMultiple && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('minSelect')}>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={minSelect}
                onChange={(e) => setMinSelect(e.target.value)}
              />
            </Field>
            <Field label={t('maxSelect')}>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={maxSelect}
                onChange={(e) => setMaxSelect(e.target.value)}
              />
            </Field>
          </div>
        )}
        <Field label={t('displayOrder')}>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
