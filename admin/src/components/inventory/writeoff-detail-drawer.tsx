'use client';

import { useTranslations } from 'next-intl';

import { useWriteOffsControllerVoid } from '@/api/generated/inventory-write-offs/inventory-write-offs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { useConfirm } from '@/components/ui/use-confirm';
import { ReasonBadge } from '@/components/inventory/writeoff-shared';
import { formatDateTime } from '@/components/inventory/shared';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useItemsForSelect } from '@/lib/inventory/use-inventory-data';
import { useWriteOff, useWriteOffsInvalidation } from '@/lib/inventory/use-writeoff-data';
import { formatNumber } from '@/lib/inventory/units';
import { formatMoney } from '@/lib/money';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

export function WriteOffDetailDrawer({
  writeOffId,
  onClose,
}: {
  writeOffId: string;
  onClose: () => void;
}) {
  const t = useTranslations('inventory');
  const tc = useTranslations('common');
  const { data: restaurant } = useRestaurant();
  const currency = restaurant?.currency ?? 'USD';
  const canVoid = usePermission(PERMISSIONS.INVENTORY_WRITEOFF_VOID);
  const invalidate = useWriteOffsInvalidation();
  const { ask, dialog } = useConfirm();

  const { data: writeOff, isLoading } = useWriteOff(writeOffId);
  const { items } = useItemsForSelect();
  const itemName = (id: string | null) =>
    id ? (items.find((i) => i.id === id)?.name ?? id) : '—';
  const voidMut = useWriteOffsControllerVoid();

  const onVoid = async () => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmVoid'),
      confirmLabel: t('woVoid'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await voidMut.mutateAsync({ id: writeOffId });
      toast.success(t('voided'));
      await invalidate(writeOffId);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Drawer
      open
      title={t('woDetailTitle')}
      onClose={onClose}
      footer={
        writeOff && canVoid && !writeOff.voidedAt ? (
          <Button variant="danger" onClick={onVoid} disabled={voidMut.isPending}>
            {t('woVoid')}
          </Button>
        ) : undefined
      }
    >
      {isLoading || !writeOff ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">{t('woReason')}</dt>
            <dd>
              <ReasonBadge reason={writeOff.reason} />
              {writeOff.voidedAt && (
                <span className="ml-2">
                  <Badge tone="gray">{t('voidedBadge')}</Badge>
                </span>
              )}
            </dd>
            <dt className="text-gray-500">{t('woOccurredAt')}</dt>
            <dd className="text-gray-800">{formatDateTime(writeOff.occurredAt)}</dd>
            <dt className="text-gray-500">{t('woCreatedBy')}</dt>
            <dd className="text-gray-800">
              {writeOff.createdByUserId}
            </dd>
            <dt className="text-gray-500">{t('woTotal')}</dt>
            <dd className="font-medium text-gray-900">
              {formatMoney(writeOff.totalCost_amount, currency)}
            </dd>
            {writeOff.note && (
              <>
                <dt className="text-gray-500">{t('woNote')}</dt>
                <dd className="text-gray-800">{writeOff.note}</dd>
              </>
            )}
          </dl>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">{t('woLineKind')}</th>
                <th className="py-2 pr-3 font-medium">{t('woLineName')}</th>
                <th className="py-2 pr-3 font-medium">{t('woLineQty')}</th>
                <th className="py-2 font-medium">{t('woLineCost')}</th>
              </tr>
            </thead>
            <tbody>
              {writeOff.lines.map((line) => (
                <tr key={line.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3">
                    <Badge tone={line.kind === 'DISH' ? 'blue' : 'gray'}>
                      {line.kind === 'DISH' ? t('kindDISH') : t('kindITEM')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 text-gray-800">
                    {line.kind === 'DISH' ? (line.menuItemId ?? '—') : itemName(line.itemId)}
                    {line.modifierOptionIds && line.modifierOptionIds.length > 0 && (
                      <span className="block text-xs text-gray-400">
                        {line.modifierOptionIds.join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-700">
                    {line.kind === 'DISH'
                      ? `×${formatNumber(line.units ?? 0)}`
                      : `${formatNumber(line.enteredQty ?? 0)}${line.enteredUnit ? ` ${line.enteredUnit}` : ''}`}
                  </td>
                  <td className="py-2 text-gray-700">{formatMoney(line.cost_amount, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog}
    </Drawer>
  );
}
