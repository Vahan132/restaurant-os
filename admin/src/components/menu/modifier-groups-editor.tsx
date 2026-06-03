'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useModifiersControllerRemoveGroup,
  useModifiersControllerRemoveOption,
} from '@/api/generated/menu-modifiers/menu-modifiers';
import {
  ModifierGroupResponseSelectionType,
  ModifierOptionResponseStatus,
  type ModifierGroupWithOptionsResponse,
  type ModifierOptionResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { ModifierGroupFormModal } from '@/components/menu/modifier-group-form-modal';
import { ModifierOptionFormModal } from '@/components/menu/modifier-option-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { formatMoney } from '@/lib/money';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

export function ModifierGroupsEditor({
  itemId,
  groups,
  currency,
  onChanged,
}: {
  itemId: string;
  groups: ModifierGroupWithOptionsResponse[];
  currency: string;
  onChanged: () => void | Promise<void>;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const { ask, dialog } = useConfirm();

  const [groupModal, setGroupModal] = useState<{
    group: ModifierGroupWithOptionsResponse | null;
  } | null>(null);
  const [optionModal, setOptionModal] = useState<{
    groupId: string;
    option: ModifierOptionResponse | null;
  } | null>(null);

  const removeGroup = useModifiersControllerRemoveGroup();
  const removeOption = useModifiersControllerRemoveOption();

  const sortedGroups = [...groups].sort((a, b) => a.displayOrder - b.displayOrder);

  const onDeleteGroup = async (group: ModifierGroupWithOptionsResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteGroup'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeGroup.mutateAsync({ id: group.id });
      toast.success(t('toast.groupDeleted'));
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const onDeleteOption = async (option: ModifierOptionResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteOption'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeOption.mutateAsync({ id: option.id });
      toast.success(t('toast.optionDeleted'));
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{t('modifierGroups')}</h3>
        <Can permission={PERMISSIONS.MENU_MANAGE}>
          <Button size="sm" variant="secondary" onClick={() => setGroupModal({ group: null })}>
            + {t('addGroup')}
          </Button>
        </Can>
      </div>

      {sortedGroups.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          {t('noGroups')}
        </p>
      ) : (
        <ul className="space-y-3">
          {sortedGroups.map((group) => {
            const options = [...group.options].sort((a, b) => a.displayOrder - b.displayOrder);
            return (
              <li key={group.id} className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{group.name}</span>
                    <Badge tone="blue">
                      {group.selectionType === ModifierGroupResponseSelectionType.SINGLE
                        ? t('single')
                        : t('multiple')}
                    </Badge>
                    {group.required && <Badge tone="amber">{t('required')}</Badge>}
                    {group.selectionType === ModifierGroupResponseSelectionType.MULTIPLE &&
                      (group.minSelect != null || group.maxSelect != null) && (
                        <span className="text-xs text-gray-500">
                          {t('minSelect')} {group.minSelect ?? 0} · {t('maxSelect')}{' '}
                          {group.maxSelect ?? '—'}
                        </span>
                      )}
                  </div>
                  <Can permission={PERMISSIONS.MENU_MANAGE}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setGroupModal({ group })}>
                        {tc('edit')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onDeleteGroup(group)}>
                        {tc('delete')}
                      </Button>
                    </div>
                  </Can>
                </div>

                <div className="px-3 py-2">
                  {options.length === 0 ? (
                    <p className="py-1 text-xs text-gray-400">—</p>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {options.map((option) => (
                        <li key={option.id} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-800">{option.name}</span>
                            <span className="tabular-nums text-gray-500">
                              +{formatMoney(option.priceDeltaAmount, currency)}
                            </span>
                            {option.status === ModifierOptionResponseStatus.INACTIVE && (
                              <Badge tone="gray">{t('inactive')}</Badge>
                            )}
                          </div>
                          <Can permission={PERMISSIONS.MENU_MANAGE}>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setOptionModal({ groupId: group.id, option })}
                              >
                                {tc('edit')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onDeleteOption(option)}
                              >
                                {tc('delete')}
                              </Button>
                            </div>
                          </Can>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Can permission={PERMISSIONS.MENU_MANAGE}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1"
                      onClick={() => setOptionModal({ groupId: group.id, option: null })}
                    >
                      + {t('addOption')}
                    </Button>
                  </Can>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {groupModal && (
        <ModifierGroupFormModal
          open
          itemId={itemId}
          group={groupModal.group}
          optionCount={groupModal.group?.options.length ?? 0}
          onClose={() => setGroupModal(null)}
          onSaved={onChanged}
        />
      )}
      {optionModal && (
        <ModifierOptionFormModal
          open
          groupId={optionModal.groupId}
          option={optionModal.option}
          currency={currency}
          onClose={() => setOptionModal(null)}
          onSaved={onChanged}
        />
      )}
      {dialog}
    </div>
  );
}
