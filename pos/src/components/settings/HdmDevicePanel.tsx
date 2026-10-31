'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ApiError } from '@/api/mutator';
import { hdmDevice, type HdmProbeResult } from '@/lib/hdmDevice';
import { PERMISSIONS, usePermission } from '@/lib/permissions';
import { toast } from '@/lib/toast';
import { useEndpointStore } from '@/stores/endpoint';

type Action = 'probe' | 'login' | 'copy' | 'x' | 'z' | 'sync';

/**
 * HDM-TM-1 — "Fiscal device" panel for waiters/cashiers: test the HDM
 * connection, reprint the last receipt, X/Z reports and sync. Everything runs
 * through the LOCAL HUB (the HDM is on the LAN); on the cloud target we show a
 * hint instead of failing silently.
 */
export function HdmDeviceButton() {
  const t = useTranslations('hdm');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-tap select-none rounded-xl border border-gray-300 bg-white px-5 text-base font-semibold text-gray-700 active:scale-95"
      >
        {t('button')}
      </button>
      {open ? <HdmDeviceDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function HdmDeviceDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('hdm');
  const target = useEndpointStore((s) => s.target);
  const canZ = usePermission(PERMISSIONS.REPORTS_VIEW);
  const [busy, setBusy] = useState<Action | null>(null);
  const [probe, setProbe] = useState<HdmProbeResult | null>(null);
  const [confirmZ, setConfirmZ] = useState(false);

  async function run(action: Action, fn: () => Promise<unknown>, okText: string) {
    if (busy) return;
    setBusy(action);
    try {
      await fn();
      toast.success(okText);
    } catch (err) {
      const e = err as ApiError;
      toast.error(t('failed'), e?.message || t('unreachable'));
    } finally {
      setBusy(null);
    }
  }

  async function runProbe() {
    if (busy) return;
    setBusy('probe');
    try {
      setProbe(await hdmDevice.probe());
    } catch (err) {
      toast.error(t('failed'), (err as ApiError)?.message || t('unreachable'));
    } finally {
      setBusy(null);
    }
  }

  const btn =
    'min-h-tap w-full select-none rounded-xl border border-gray-300 bg-white px-4 text-base font-semibold text-gray-800 active:scale-95 disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('title')}</h2>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-gray-400" aria-label={t('close')}>
            ×
          </button>
        </div>

        {target !== 'hub' ? (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('needsHub')}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={btn} disabled={busy !== null} onClick={() => void runProbe()}>
            {busy === 'probe' ? t('working') : t('probe')}
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy !== null}
            onClick={() => void run('login', hdmDevice.testLogin, t('loginOk'))}
          >
            {busy === 'login' ? t('working') : t('testLogin')}
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy !== null}
            onClick={() => void run('copy', hdmDevice.printLastCopy, t('printed'))}
          >
            {busy === 'copy' ? t('working') : t('printLastCopy')}
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy !== null}
            onClick={() => void run('x', hdmDevice.xReport, t('printed'))}
          >
            {busy === 'x' ? t('working') : t('xReport')}
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy !== null}
            onClick={() => void run('sync', hdmDevice.sync, t('synced'))}
          >
            {busy === 'sync' ? t('working') : t('sync')}
          </button>
          {canZ ? (
            confirmZ ? (
              <button
                type="button"
                className={`${btn} border-red-300 bg-red-50 text-red-700`}
                disabled={busy !== null}
                onClick={() => {
                  setConfirmZ(false);
                  void run('z', hdmDevice.zReport, t('printed'));
                }}
              >
                {t('zConfirm')}
              </button>
            ) : (
              <button type="button" className={btn} disabled={busy !== null} onClick={() => setConfirmZ(true)}>
                {busy === 'z' ? t('working') : t('zReport')}
              </button>
            )
          ) : null}
        </div>

        {probe ? <ProbeResult probe={probe} /> : null}
      </div>
    </div>
  );
}

function ProbeResult({ probe }: { probe: HdmProbeResult }) {
  const t = useTranslations('hdm');
  return (
    <div className="mt-4 space-y-2 text-sm">
      <p className={probe.ok ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>
        {probe.ok ? t('probeOk', { host: probe.host, port: probe.port, ms: probe.durationMs }) : t('probeFail', { host: probe.host, port: probe.port })}
      </p>
      {!probe.ok ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
          {probe.errorCode ? `[${probe.errorCode}] ` : ''}
          {probe.errorMessage}
        </p>
      ) : null}
      {probe.operatorFound === false ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{t('operatorMissing')}</p>
      ) : null}
      {probe.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-gray-800">{t('operators')}</p>
            <ul className="space-y-0.5 text-gray-600">
              {probe.data.operators.map((o) => (
                <li key={o.id}>
                  #{o.id} {o.name} <span className="text-gray-400">({o.deps.join(', ')})</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-gray-800">{t('departments')}</p>
            <ul className="space-y-0.5 text-gray-600">
              {probe.data.departments.map((d) => (
                <li key={d.id}>
                  #{d.id} {d.name} <span className="text-gray-400">({t('taxType', { type: d.type })})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      <p className="text-xs text-gray-400">
        {t('hubIps')}: {probe.hubAddresses.join(', ') || '—'}
        {probe.responseHeaderHex ? ` · hdr ${probe.responseHeaderHex}` : ''}
      </p>
    </div>
  );
}
