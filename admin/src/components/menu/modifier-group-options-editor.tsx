'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import {
  useModifierGroupsControllerRemoveOption,
  useModifierGroupsControllerReorderGroupOptions,
} from '@/api/generated/menu-modifier-groups/menu-modifier-groups';
import {
  ModifierOptionResponseStatus,
  type ModifierOptionResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { ModifierOptionFormModal } from '@/components/menu/modifier-option-form-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { useModifierGroup, useModifierGroupsInvalidation } from '@/lib/menu/use-modifier-groups';
import { formatMoney } from '@/lib/money';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

/**
 * Manage the options of a single library modifier group: add, edit, remove and
 * reorder (sortOrder). Fetches the group detail itself so it can be dropped
 * anywhere the group id is known.
 */
export function ModifierGroupOptionsEditor({
  groupId,
  currency,
}: {
  groupId: string;
  currency: string;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const { ask, dialog } = useConfirm();
  const { invalidateGroup, invalidateGroups } = useModifierGroupsInvalidation();

  const detailQuery = useModifierGroup(groupId);
  const options = useMemo(
    () => [...(detailQuery.data?.options ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [detailQuery.data],
  );

  const [optionModal, setOptionModal] = useState<{ option: ModifierOptionResponse | null } | null>(
    null,
  );

  const removeOption = useModifierGroupsControllerRemoveOption();
  const reorder = useModifierGroupsControllerReorderGroupOptions();

  const refresh = async () => {
    await Promise.all([invalidateGroup(groupId), invalidateGroups()]);
  };

  const onDelete = async (option: ModifierOptionResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmDeleteOption'),
      confirmLabel: tc('delete'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await removeOption.mutateAsync({ groupId, optionId: option.id });
      toast.success(t('toast.optionDeleted'));
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= options.length) return;
    const ids = options.map((o) => o.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await reorder.mutateAsync({ groupId, data: { optionIds: ids } });
      toast.success(t('reorderSaved'));
      await refresh();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const nextSortOrder =
    options.length > 0 ? Math.max(...options.map((o) => o.sortOrder)) + 1 : 0;

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">{t('options')}</h4>
        <Can permission={PERMISSIONS.MENU_MANAGE}>
          <Button size="sm" variant="secondary" onClick={() => setOptionModal({ option: null })}>
            + {t('addOption')}
          </Button>
        </Can>
      </div>

      {options.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-3 text-center text-sm text-gray-500">
          {t('noOptions')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {options.map((option, index) => (
            <li key={option.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-800">{option.name}</span>
                <span className="tabular-nums text-gray-500">
                  {option.priceDeltaAmount >= 0 ? '+' : ''}
                  {formatMoney(option.priceDeltaAmount, currency)}
                </span>
                {option.isDefault && <Badge tone="green">{t('defaultOption')}</Badge>}
                {option.status === ModifierOptionResponseStatus.INACTIVE && (
                  <Badge tone="gray">{t('inactive')}</Badge>
                )}
              </div>
              <Can permission={PERMISSIONS.MENU_MANAGE}>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('moveUp')}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('moveDown')}
                    disabled={index === options.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setOptionModal({ option })}
                  >
                    {tc('edit')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(option)}>
                    {tc('delete')}
                  </Button>
                </div>
              </Can>
            </li>
          ))}
        </ul>
      )}

      {optionModal && (
        <ModifierOptionFormModal
          open
          groupId={groupId}
          option={optionModal.option}
          currency={currency}
          nextSortOrder={nextSortOrder}
          onClose={() => setOptionModal(null)}
          onSaved={refresh}
        />
      )}
      {dialog}
    </div>
  );
}
