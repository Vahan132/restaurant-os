'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AvailabilityPanel } from '@/components/reservations/availability-panel';
import { DayView } from '@/components/reservations/day-view';
import { MissedCallInbox } from '@/components/reservations/missed-call-inbox';
import { DevicesPanel } from '@/components/reservations/devices-panel';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useMissedCallsLive,
  useNewMissedCallCount,
} from '@/lib/reservations/use-missed-calls-data';
import { PERMISSIONS } from '@/lib/permissions';
import { useRestaurant } from '@/lib/restaurant/use-restaurant';
import { useRestaurantSettings } from '@/lib/tables/use-tables-data';

type Tab = 'day' | 'availability' | 'missed' | 'devices';

export function ReservationsManager() {
  const t = useTranslations('reservations');
  const [tab, setTab] = useState<Tab>('day');

  const { data: restaurant } = useRestaurant();
  const { settings } = useRestaurantSettings();
  const canManage = usePermission(PERMISSIONS.RESERVATION_MANAGE);

  const timezone =
    restaurant?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const enableReservations = settings?.enableReservations ?? true;
  const writesEnabled = canManage && enableReservations;

  // Missed-call reads do NOT depend on enableReservations. Keep the NEW count
  // live so the tab badge bumps on incoming calls regardless of active tab.
  const newCalls = useNewMissedCallCount();
  useMissedCallsLive();

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'day', label: t('dayView') },
    { key: 'availability', label: t('availabilityTab') },
    { key: 'missed', label: t('tabMissed'), badge: newCalls },
    { key: 'devices', label: t('tabDevices') },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>

      {!enableReservations && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t('reservationsDisabled')}
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.label}
            {item.badge ? (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === 'day' && <DayView timezone={timezone} writesEnabled={writesEnabled} />}
      {tab === 'availability' && <AvailabilityPanel timezone={timezone} />}
      {tab === 'missed' && (
        <MissedCallInbox timezone={timezone} writesEnabled={writesEnabled} />
      )}
      {tab === 'devices' && <DevicesPanel />}
    </div>
  );
}
