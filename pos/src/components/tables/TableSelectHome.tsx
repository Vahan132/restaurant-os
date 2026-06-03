'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { TableResponse } from '@/api/generated/model';
import { useFloorPlan } from '@/lib/useFloorPlan';
import { useActiveOrders } from '@/lib/useActiveOrders';
import { useOrderFlow } from '@/lib/useOrderFlow';
import { useFloorRealtimeSync } from '@/lib/realtime/useFloorRealtimeSync';
import { toast } from '@/lib/toast';
import { Can, PERMISSIONS } from '@/lib/permissions';
import { TableTile } from './TableTile';
import { StatusLegend } from './StatusLegend';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type PendingConfirm = { kind: 'reserved' | 'cleaning'; table: TableResponse } | null;

/**
 * Actionable table-select home. Tiles route into the order flow by status:
 * AVAILABLE → open dine-in, RESERVED → confirm + seat, OCCUPIED → resume,
 * CLEANING → mark cleaned, DISABLED → inert (info toast). Plus floor tabs, a
 * "My orders" filter and a "New takeaway" action. Live via realtime invalidation.
 */
export function TableSelectHome() {
  const t = useTranslations('home');
  const tc = useTranslations('confirm');
  const tt = useTranslations('table');
  const tCommon = useTranslations('common');

  const [mine, setMine] = useState(false);
  const [activeFloorId, setActiveFloorId] = useState<string | 'all'>('all');
  const [pending, setPending] = useState<PendingConfirm>(null);

  const { data: floors, isLoading, isError, refetch } = useFloorPlan();
  const { ordersByTableId } = useActiveOrders({ mine });
  const flow = useOrderFlow();
  useFloorRealtimeSync();

  const allFloors = useMemo(() => floors ?? [], [floors]);
  const visibleFloors = useMemo(
    () => (activeFloorId === 'all' ? allFloors : allFloors.filter((f) => f.id === activeFloorId)),
    [allFloors, activeFloorId],
  );

  function handleSelect(table: TableResponse) {
    switch (table.status) {
      case 'AVAILABLE':
        void flow.openDineIn(table.id);
        break;
      case 'RESERVED':
        setPending({ kind: 'reserved', table });
        break;
      case 'OCCUPIED':
        void flow.resume(table.id, ordersByTableId.get(table.id));
        break;
      case 'CLEANING':
        setPending({ kind: 'cleaning', table });
        break;
      case 'DISABLED':
        toast.info(tt('disabledTitle'), tt('disabledBody'));
        break;
    }
  }

  function confirmPending() {
    if (!pending) return;
    const { kind, table } = pending;
    setPending(null);
    if (kind === 'reserved') void flow.openDineIn(table.id);
    else void flow.markCleaned(table.id);
  }

  if (isLoading) return <p className="p-4 text-lg text-gray-500">{tCommon('loading')}</p>;

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-lg text-red-600">{t('loadError')}</p>
        <button
          onClick={() => refetch()}
          className="min-h-tap rounded-xl bg-gray-900 px-5 font-semibold text-white active:scale-95"
        >
          {tCommon('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMine((v) => !v)}
            aria-pressed={mine}
            className={`min-h-tap select-none rounded-xl border px-4 text-base font-semibold active:scale-95 ${
              mine ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {t('myOrders')}
          </button>
          <Can perform={PERMISSIONS.ORDER_CREATE}>
            <button
              type="button"
              onClick={() => flow.newTakeaway()}
              disabled={flow.takeawayBusy}
              className="min-h-tap select-none rounded-xl bg-emerald-600 px-5 text-base font-bold text-white active:scale-95 disabled:opacity-60"
            >
              {t('newTakeaway')}
            </button>
          </Can>
        </div>
      </div>

      {/* Floor tabs */}
      {allFloors.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <FloorTab label={t('allFloors')} active={activeFloorId === 'all'} onClick={() => setActiveFloorId('all')} />
          {allFloors.map((f) => (
            <FloorTab
              key={f.id}
              label={f.name}
              active={activeFloorId === f.id}
              onClick={() => setActiveFloorId(f.id)}
            />
          ))}
        </div>
      ) : null}

      <StatusLegend />

      {!allFloors.length ? (
        <p className="p-4 text-lg text-gray-500">{t('noFloors')}</p>
      ) : (
        visibleFloors.map((floor) => (
          <section key={floor.id}>
            <h3 className="mb-3 text-lg font-semibold text-gray-700">{floor.name}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
              {floor.tables.map((table) => (
                <TableTile
                  key={table.id}
                  table={table}
                  order={ordersByTableId.get(table.id)}
                  busy={flow.isBusy(table.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <ConfirmDialog
        open={pending?.kind === 'reserved'}
        title={tc('reservedTitle')}
        body={pending ? tc('reservedBody', { table: pending.table.name }) : ''}
        confirmLabel={tc('reservedConfirm')}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'cleaning'}
        title={tc('cleaningTitle')}
        body={pending ? tc('cleaningBody', { table: pending.table.name }) : ''}
        confirmLabel={tc('cleaningConfirm')}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

function FloorTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-tap select-none rounded-xl px-5 text-base font-semibold active:scale-95 ${
        active ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300'
      }`}
    >
      {label}
    </button>
  );
}
