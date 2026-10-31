'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import {
  useBranchFiscalSettings,
  useSaveBranchDepartments,
  useSaveBranchHdm,
} from '@/lib/fiscal/branch-fiscal-settings';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

type DeptRow = { dep: string; taxRegime: string; label: string };

/**
 * HDM-TM-2 — "Fiscal / HDM" tab: the ACTIVE branch's own TouchMaster (physical
 * HDM) connection. Each branch has its own device. Password and PIN are
 * write-only (blank = keep). The hub on site receives these automatically; the
 * live connection test runs from the POS (HDM button) because only the hub can
 * reach the device on the restaurant network.
 */
export function FiscalTab() {
  const t = useTranslations('fiscalSettings');
  const canManage = usePermission(PERMISSIONS.SETTINGS_MANAGE);
  const { data, isLoading } = useBranchFiscalSettings();
  const saveHdm = useSaveBranchHdm();
  const saveDeps = useSaveBranchDepartments();
  const s = data?.settings ?? null;

  const [active, setActive] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8080');
  const [password, setPassword] = useState('');
  const [cashier, setCashier] = useState('');
  const [pin, setPin] = useState('');
  const [useExtPos, setUseExtPos] = useState(true);
  const [printMode, setPrintMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [crn, setCrn] = useState('');
  const [depts, setDepts] = useState<DeptRow[]>([]);

  useEffect(() => {
    setActive(s?.active ?? false);
    setHost(s?.deviceHost ?? '');
    setPort(s?.devicePort != null ? String(s.devicePort) : '8080');
    setCashier(s?.deviceCashierId != null ? String(s.deviceCashierId) : '');
    setUseExtPos(s?.deviceUseExtPos ?? true);
    setPrintMode(s?.fiscalPrintMode ?? 'AUTO');
    setCrn(s?.crn ?? '');
    setDepts((s?.departments ?? []).map((d) => ({ dep: d.dep, taxRegime: d.taxRegime, label: d.label ?? '' })));
    setPassword('');
    setPin('');
  }, [s]);

  async function onSaveDevice() {
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      toast.error(t('portInvalid'));
      return;
    }
    const cashierNum = cashier.trim() === '' ? null : Number(cashier);
    if (cashierNum !== null && (!Number.isInteger(cashierNum) || cashierNum < 0)) {
      toast.error(t('cashierInvalid'));
      return;
    }
    try {
      await saveHdm.mutateAsync({
        active,
        crn: crn.trim() || null,
        host: host.trim(),
        port: portNum,
        ...(password !== '' ? { password } : {}),
        ...(pin.trim() !== '' ? { pin: pin.trim() } : {}),
        cashierId: cashierNum,
        useExtPos,
        printMode,
      });
      toast.success(t('saved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onSaveDepts() {
    const rows = depts.filter((d) => d.dep.trim() !== '' || d.taxRegime.trim() !== '');
    if (rows.some((d) => d.dep.trim() === '' || d.taxRegime.trim() === '')) {
      toast.error(t('deptIncomplete'));
      return;
    }
    try {
      await saveDeps.mutateAsync(
        rows.map((d) => ({ dep: d.dep.trim(), taxRegime: d.taxRegime.trim(), label: d.label.trim() || null })),
      );
      toast.success(t('savedDepts'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">…</p>;

  const firstSetup = !s?.deviceConfigured;

  return (
    <div className="max-w-2xl space-y-4">
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
            <p className="text-xs text-gray-500">{t('subtitle')}</p>
          </div>
          {s?.deviceConfigured ? (
            <Badge tone={s.active ? 'green' : 'gray'}>{s.active ? t('on') : t('off')}</Badge>
          ) : (
            <Badge tone="amber">{t('notSetUp')}</Badge>
          )}
        </div>

        <details className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-800">{t('guideTitle')}</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>{t('guide1')}</li>
            <li>{t('guide2')}</li>
            <li>{t('guide3')}</li>
            <li>{t('guide4')}</li>
            <li>{t('guide5')}</li>
            <li>{t('guide6')}</li>
          </ol>
        </details>

        <Toggle label={t('active')} description={t('activeHint')} checked={active} disabled={!canManage} onChange={setActive} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('host')} required>
            <input className={inputClass} value={host} disabled={!canManage} onChange={(e) => setHost(e.target.value)} placeholder="10.23.85.211" />
          </Field>
          <Field label={t('port')} required>
            <input className={inputClass} type="number" min={1} max={65535} value={port} disabled={!canManage} onChange={(e) => setPort(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('password')} required={firstSetup}>
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={password}
                disabled={!canManage}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={s?.deviceConfigured ? t('secretKept') : ''}
              />
            </Field>
          </div>
          <Field label={t('cashier')}>
            <input className={inputClass} type="number" min={0} value={cashier} disabled={!canManage} onChange={(e) => setCashier(e.target.value)} placeholder="3" />
          </Field>
          <Field label={t('pin')}>
            <input
              className={inputClass}
              type="password"
              autoComplete="new-password"
              value={pin}
              disabled={!canManage}
              onChange={(e) => setPin(e.target.value)}
              placeholder={s?.devicePinConfigured ? t('secretKept') : ''}
            />
          </Field>
          <Field label={t('crn')}>
            <input className={inputClass} value={crn} disabled={!canManage} onChange={(e) => setCrn(e.target.value)} />
          </Field>
          <Field label={t('printMode')}>
            <select className={inputClass} value={printMode} disabled={!canManage} onChange={(e) => setPrintMode(e.target.value as 'AUTO' | 'MANUAL')}>
              <option value="AUTO">{t('printAuto')}</option>
              <option value="MANUAL">{t('printManual')}</option>
            </select>
          </Field>
        </div>

        <Toggle label={t('useExtPos')} description={t('useExtPosHint')} checked={useExtPos} disabled={!canManage} onChange={setUseExtPos} />

        <Button
          variant="primary"
          onClick={onSaveDevice}
          disabled={!canManage || saveHdm.isPending || host.trim() === '' || port === '' || (firstSetup && password === '')}
        >
          {t('save')}
        </Button>
        <p className="text-xs text-gray-500">{t('testHint')}</p>
      </section>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">{t('deptTitle')}</h2>
        <p className="text-xs text-gray-500">{t('deptHint')}</p>
        {!s ? (
          <p className="text-sm text-gray-500">{t('saveDeviceFirst')}</p>
        ) : (
          <>
            <div className="space-y-2">
              {depts.map((row, i) => (
                <div key={i} className="grid grid-cols-[5rem_6rem_1fr_auto] gap-2">
                  <input
                    className={inputClass}
                    placeholder={t('deptNo')}
                    value={row.dep}
                    disabled={!canManage}
                    onChange={(e) => setDepts((r) => r.map((x, j) => (j === i ? { ...x, dep: e.target.value } : x)))}
                  />
                  <input
                    className={inputClass}
                    placeholder={t('deptTax')}
                    value={row.taxRegime}
                    disabled={!canManage}
                    onChange={(e) => setDepts((r) => r.map((x, j) => (j === i ? { ...x, taxRegime: e.target.value } : x)))}
                  />
                  <input
                    className={inputClass}
                    placeholder={t('deptName')}
                    value={row.label}
                    disabled={!canManage}
                    onChange={(e) => setDepts((r) => r.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                  <Button variant="ghost" disabled={!canManage} onClick={() => setDepts((r) => r.filter((_, j) => j !== i))}>
                    ×
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button disabled={!canManage} onClick={() => setDepts((r) => [...r, { dep: '', taxRegime: '', label: '' }])}>
                {t('deptAdd')}
              </Button>
              <Button variant="primary" disabled={!canManage || saveDeps.isPending} onClick={onSaveDepts}>
                {t('deptSave')}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
