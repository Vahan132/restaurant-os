'use client';

import { useCallback, useEffect, useState } from 'react';

import { presetRange, type DateRange, type GroupBy, type RangePreset } from '@/lib/reports/date-range';

const STORAGE_KEY = 'reports-range-v1';

interface PersistedRange {
  preset: RangePreset;
  custom: DateRange;
  groupBy: GroupBy;
}

function load(): PersistedRange | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedRange) : null;
  } catch {
    return null;
  }
}

/**
 * Holds the report date range + groupBy, persisted to localStorage so the
 * chosen range survives across the report views and reloads. Presets resolve
 * against the restaurant timezone; "custom" keeps explicit from/to.
 */
export function useReportRange(timeZone: string) {
  const [preset, setPresetState] = useState<RangePreset>('today');
  const [custom, setCustom] = useState<DateRange>({ from: '', to: '' });
  const [groupBy, setGroupByState] = useState<GroupBy>('day');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = load();
    if (saved) {
      setPresetState(saved.preset);
      setCustom(saved.custom);
      setGroupByState(saved.groupBy);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, custom, groupBy }));
  }, [ready, preset, custom, groupBy]);

  const range: DateRange =
    preset === 'custom' ? custom : presetRange(preset, timeZone);

  const setPreset = useCallback((p: RangePreset) => setPresetState(p), []);
  const setCustomRange = useCallback((r: DateRange) => {
    setCustom(r);
    setPresetState('custom');
  }, []);
  const setGroupBy = useCallback((g: GroupBy) => setGroupByState(g), []);

  return { preset, groupBy, range, setPreset, setCustomRange, setGroupBy };
}
