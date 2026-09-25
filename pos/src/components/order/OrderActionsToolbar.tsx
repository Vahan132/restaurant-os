'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { OrderResponse } from '@/api/generated/model';
import { Can, PERMISSIONS } from '@/lib/permissions';
import type { useOrderActions } from '@/lib/useOrderActions';
import { DiscountSheet } from './DiscountSheet';
import { MoveTableSheet } from './MoveTableSheet';
import { CancelReasonModal } from './CancelReasonModal';

interface OrderActionsToolbarProps {
  order: OrderResponse;
  actions: ReturnType<typeof useOrderActions>;
}

type Sheet = 'discount' | 'move' | 'cancelOrder' | null;

/** Toolbar of order-management actions: discount, move table, mark served, cancel order. */
export function OrderActionsToolbar({ order, actions }: OrderActionsToolbarProps) {
  const t = useTranslations('actions');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [overflow, setOverflow] = useState(false);

  const anyReady = order.items.some((i) => i.status === 'READY');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Any order editor can open the discount sheet. Holders of DISCOUNT_APPLY
          apply directly; everyone else is taken through the manager-PIN step-up. */}
      <Can perform={PERMISSIONS.ORDER_EDIT}>
        <ToolbarButton
          label={t('discount')}
          disabled={!actions.allowDiscounts}
          title={!actions.allowDiscounts ? t('discountsDisabled') : undefined}
          onClick={() => setSheet('discount')}
        />
      </Can>

      <Can perform={PERMISSIONS.ORDER_MOVE_TABLE}>
        <ToolbarButton label={t('moveTable')} disabled={actions.moving} onClick={() => setSheet('move')} />
      </Can>

      <Can perform={PERMISSIONS.ORDER_EDIT}>
        <ToolbarButton
          testId="mark-served"
          label={t('markServed')}
          disabled={actions.serving || order.items.length === 0}
          highlight={anyReady}
          onClick={() => actions.markServed()}
        />
      </Can>

      <Can perform={PERMISSIONS.ORDER_CANCEL}>
        <div className="relative">
          <ToolbarButton label="⋯" onClick={() => setOverflow((v) => !v)} />
          {overflow ? (
            <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setOverflow(false);
                  setSheet('cancelOrder');
                }}
                disabled={!actions.allowCancellation}
                className="block w-full px-4 py-3 text-left text-base font-semibold text-red-600 disabled:opacity-40"
              >
                {t('cancelOrder')}
              </button>
            </div>
          ) : null}
        </div>
      </Can>

      {sheet === 'discount' ? (
        <DiscountSheet
          order={order}
          busy={actions.discounting}
          onApply={async (args) => {
            await actions.applyDiscount(args);
            setSheet(null);
          }}
          onRemove={async () => {
            await actions.removeDiscount();
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'move' ? (
        <MoveTableSheet
          currentTableId={order.tableId}
          busy={actions.moving}
          onPick={async (tableId) => {
            await actions.moveTable(tableId);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet === 'cancelOrder' ? (
        <CancelReasonModal
          title={t('cancelOrderTitle')}
          body={t('cancelOrderBody')}
          confirmLabel={t('cancelOrder')}
          busy={actions.cancelling}
          onConfirm={async (reason) => {
            setSheet(null);
            await actions.cancelOrder(reason);
          }}
          onCancel={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  highlight,
  title,
  testId,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
  title?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`min-h-tap select-none rounded-xl px-4 text-base font-semibold active:scale-95 disabled:opacity-40 ${
        highlight
          ? 'bg-green-600 text-white'
          : 'bg-white text-gray-700 ring-1 ring-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
