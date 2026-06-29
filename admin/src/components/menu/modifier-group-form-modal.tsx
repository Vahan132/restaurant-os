'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useModifierGroupsControllerCreate,
  useModifierGroupsControllerUpdate,
} from '@/api/generated/menu-modifier-groups/menu-modifier-groups';
import {
  CreateModifierGroupDtoSelectionType,
  ModifierGroupResponseSelectionType,
  type ModifierGroupResponse,
} from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from '@/stores/toast';

type SelectionType = CreateModifierGroupDtoSelectionType;

/**
 * Create or edit a reusable library modifier group. Enforces the backend rules
 * inline (min ≤ max, SINGLE caps at 1, required implies min ≥ 1) and surfaces
 * backend errors gracefully. Options are managed separately (see the group
 * options editor), so this form only covers the group's own rules.
 */
export function ModifierGroupFormModal({
  open,
  group,
  onClose,
  onSaved,
}: {
  open: boolean;
  group?: ModifierGroupResponse | null;
  onClose: () => void;
  onSaved?: (saved: ModifierGroupResponse) => void | Promise<void>;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const isEdit = !!group;

  const [name, setName] = useState(group?.name ?? '');
  const [selectionType, setSelectionType] = useState<SelectionType>(
    (group?.selectionType as SelectionType) ?? CreateModifierGroupDtoSelectionType.SINGLE,
  );
  const [required, setRequired] = useState(group?.required ?? false);
  const [minSelect, setMinSelect] = useState(
    group?.minSelect != null ? String(group.minSelect) : '',
  );
  const [maxSelect, setMaxSelect] = useState(
    group?.maxSelect != null ? String(group.maxSelect) : '',
  );
  const [error, setError] = useState<string>();

  const create = useModifierGroupsControllerCreate();
  const update = useModifierGroupsControllerUpdate();
  const submitting = create.isPending || update.isPending;
  const isMultiple = selectionType === ModifierGroupResponseSelectionType.MULTIPLE;

  const submit = async () => {
    if (!name.trim()) {
      setError(t('validation.required'));
      return;
    }
    const min = minSelect === '' ? undefined : Number(minSelect);
    const max = maxSelect === '' ? undefined : Number(maxSelect);

    if (isMultiple) {
      if (min != null && min < 0) {
        setError(t('validation.minNonNegative'));
        return;
      }
      if (max != null && max < 1) {
        setError(t('validation.maxAtLeastOne'));
        return;
      }
      if (min != null && max != null && min > max) {
        setError(t('validation.minMax'));
        return;
      }
    }
    // required implies at least one selection.
    if (required && isMultiple && (min == null || min < 1)) {
      setError(t('validation.requiredMin'));
      return;
    }
    setError(undefined);

    // SINGLE caps at 1, so min/max are not sent for SINGLE (the backend
    // enforces the cap). They are only meaningful for MULTIPLE.
    const base = {
      name: name.trim(),
      selectionType,
      required,
      minSelect: isMultiple ? min : undefined,
      maxSelect: isMultiple ? max : undefined,
    };

    try {
      const saved =
        isEdit && group
          ? await update.mutateAsync({ id: group.id, data: base })
          : await create.mutateAsync({ data: base });
      toast.success(t('toast.groupSaved'));
      await onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t('editGroup') : t('newGroup')}
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
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
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
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
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
        {!isMultiple && (
          <p className="text-xs text-gray-500">{t('singleHint')}</p>
        )}
      </div>
    </Modal>
  );
}
