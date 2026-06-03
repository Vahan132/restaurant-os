'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Station } from '@/lib/realtime/client';
import { ALL_STATIONS, useStationStore } from '@/lib/station/store';

/** Full-screen picker for choosing one or more stations. Selection is persisted. */
export function StationPicker() {
  const t = useTranslations('station');
  const setStations = useStationStore((s) => s.setStations);
  const [selected, setSelected] = useState<Set<Station>>(new Set());

  function toggle(station: Station) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(station)) next.delete(station);
      else next.add(station);
      return next;
    });
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 px-8">
      <div className="text-center">
        <h1 className="text-kiosk-xl font-bold">{t('pickerTitle')}</h1>
        <p className="mt-2 text-kiosk text-kiosk-muted">{t('pickerHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {ALL_STATIONS.map((station) => {
          const active = selected.has(station);
          return (
            <button
              key={station}
              type="button"
              onClick={() => toggle(station)}
              className={`h-40 w-72 rounded-2xl border-4 text-kiosk-xl font-bold transition-colors ${
                active
                  ? 'border-status-sent bg-status-sent/20 text-kiosk-text'
                  : 'border-kiosk-border bg-kiosk-panel text-kiosk-muted hover:border-kiosk-muted'
              }`}
            >
              {t(station)}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={selected.size === 0}
        onClick={() => setStations([...selected])}
        className="rounded-xl bg-status-ready px-12 py-5 text-kiosk-lg font-bold text-black disabled:opacity-40"
      >
        {t('confirm')}
      </button>
    </div>
  );
}
