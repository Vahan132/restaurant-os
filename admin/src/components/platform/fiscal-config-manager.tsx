'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type {
  FiscalConfigStatusResponse,
  OrganizationSummaryResponse,
  PlatformBranchResponse,
  RestaurantWithHallsResponse,
  UpsertFiscalConfigDtoEnvironment,
  UpsertFiscalConfigDtoLanguage,
} from '@/api/generated/model';
import {
  getPlatformFiscalConfigControllerStatusQueryKey,
  usePlatformFiscalConfigControllerBranches,
  usePlatformFiscalConfigControllerCheckConnection,
  usePlatformFiscalConfigControllerSetDeps,
  usePlatformFiscalConfigControllerSetDeviceConfig,
  usePlatformFiscalConfigControllerSetPrintModeConfig,
  usePlatformFiscalConfigControllerStatus,
  usePlatformFiscalConfigControllerUploadCert,
  usePlatformFiscalConfigControllerUpsertConfig,
} from '@/api/generated/platform-fiscal-config/platform-fiscal-config';
import { useOrganizationsControllerList } from '@/api/generated/platform-organizations/platform-organizations';
import { usePlatformAdminControllerOrgRestaurants } from '@/api/generated/platform/platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { inputClass } from '@/components/ui/form';
import { getErrorMessage } from '@/lib/api-error';
import { toast } from '@/stores/toast';

type DeptRow = { dep: string; taxRegime: string; label: string };
type PrintMode = 'AUTO' | 'MANUAL';

/**
 * Platform-admin (support) fiscal-config management. Pick org -> restaurant ->
 * branch, then edit the e-HDM config, the dep->regime map, upload the cert
 * (write-only), and test the connection. Mirrors the CATALOG-2-FE conventions
 * (useState forms, generated hooks, toast). Secrets are never fetched or shown —
 * the read model has no cert field; the cert is upload-only.
 */
export function FiscalConfigManager() {
  const t = useTranslations('platformFiscal');
  const qc = useQueryClient();

  const [orgId, setOrgId] = useState('');
  const [restaurantId, setRestaurantId] = useState('');
  const [branchId, setBranchId] = useState('');

  const orgsQ = useOrganizationsControllerList();
  const restaurantsQ = usePlatformAdminControllerOrgRestaurants(orgId, {
    query: { enabled: orgId !== '' },
  });
  const branchesQ = usePlatformFiscalConfigControllerBranches(restaurantId, {
    query: { enabled: restaurantId !== '' },
  });
  const statusQ = usePlatformFiscalConfigControllerStatus(restaurantId, branchId, {
    query: { enabled: restaurantId !== '' && branchId !== '', retry: false },
  });

  const orgs = (orgsQ.data ?? []) as OrganizationSummaryResponse[];
  const restaurants = (restaurantsQ.data ?? []) as RestaurantWithHallsResponse[];
  const branches = (branchesQ.data ?? []) as PlatformBranchResponse[];
  const status = statusQ.data as FiscalConfigStatusResponse | undefined;

  // ── config form state ────────────────────────────────────────────────────
  const [crn, setCrn] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [environment, setEnvironment] = useState<UpsertFiscalConfigDtoEnvironment>('TEST');
  const [language, setLanguage] = useState<UpsertFiscalConfigDtoLanguage>('hy');
  const [active, setActive] = useState(false);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [certPem, setCertPem] = useState('');
  const [keyPem, setKeyPem] = useState('');
  const [checkResult, setCheckResult] = useState<'ok' | 'fail' | null>(null);
  const [hydratedKey, setHydratedKey] = useState('');

  // ── device + print-mode state ────────────────────────────────────────────
  // Password is write-only (mirror the cert pattern): never hydrated from
  // status, cleared after every save, and never rendered.
  const [deviceHost, setDeviceHost] = useState('');
  const [devicePort, setDevicePort] = useState('');
  const [devicePassword, setDevicePassword] = useState('');
  const [printMode, setPrintMode] = useState<PrintMode>('AUTO');

  const selKey = `${restaurantId}:${branchId}`;
  const branchSelected = restaurantId !== '' && branchId !== '';
  const configExists = status !== undefined;

  // Hydrate the form when a branch's status resolves (or blank it when 404).
  useEffect(() => {
    if (!branchSelected || statusQ.isLoading || hydratedKey === selKey) {
      return;
    }
    if (status) {
      setCrn(status.crn);
      setCashierId(status.cashierId);
      setEnvironment(status.environment as UpsertFiscalConfigDtoEnvironment);
      setLanguage(status.language as UpsertFiscalConfigDtoLanguage);
      setActive(status.active);
      setDepts(
        status.departments.map((d) => ({
          dep: d.dep,
          taxRegime: d.taxRegime,
          label: d.label ?? '',
        })),
      );
      setDeviceHost(status.deviceHost ?? '');
      setDevicePort(status.devicePort != null ? String(status.devicePort) : '');
      setPrintMode(status.fiscalPrintMode as PrintMode);
    } else {
      setCrn('');
      setCashierId('');
      setEnvironment('TEST');
      setLanguage('hy');
      setActive(false);
      setDepts([]);
      setDeviceHost('');
      setDevicePort('');
      setPrintMode('AUTO');
    }
    setCertPem('');
    setKeyPem('');
    setDevicePassword('');
    setCheckResult(null);
    setHydratedKey(selKey);
  }, [status, statusQ.isLoading, selKey, branchSelected, hydratedKey]);

  // ── mutations ──────────────────────────────────────────────────────────────
  const upsertMut = usePlatformFiscalConfigControllerUpsertConfig();
  const certMut = usePlatformFiscalConfigControllerUploadCert();
  const deptsMut = usePlatformFiscalConfigControllerSetDeps();
  const checkMut = usePlatformFiscalConfigControllerCheckConnection();
  const deviceMut = usePlatformFiscalConfigControllerSetDeviceConfig();
  const printModeMut = usePlatformFiscalConfigControllerSetPrintModeConfig();

  async function refreshStatus() {
    await qc.invalidateQueries({
      queryKey: getPlatformFiscalConfigControllerStatusQueryKey(restaurantId, branchId),
    });
  }

  async function saveConfig() {
    try {
      await upsertMut.mutateAsync({
        restaurantId,
        branchId,
        data: { crn, cashierId, environment, language, active },
      });
      await refreshStatus();
      toast.success(t('savedConfig'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function saveDepts() {
    try {
      await deptsMut.mutateAsync({
        restaurantId,
        branchId,
        data: {
          departments: depts
            .filter((d) => d.dep.trim() !== '')
            .map((d) => ({
              dep: d.dep.trim(),
              taxRegime: d.taxRegime.trim(),
              label: d.label.trim() === '' ? null : d.label.trim(),
            })),
        },
      });
      await refreshStatus();
      toast.success(t('savedDepts'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function uploadCert() {
    try {
      await certMut.mutateAsync({
        restaurantId,
        branchId,
        data: { clientCertPem: certPem, clientKeyPem: keyPem },
      });
      setCertPem('');
      setKeyPem('');
      await refreshStatus();
      toast.success(t('savedCert'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function saveDevice() {
    const portNum = Number(devicePort);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      toast.error(t('devicePortInvalid'));
      return;
    }
    try {
      await deviceMut.mutateAsync({
        restaurantId,
        branchId,
        data: { host: deviceHost.trim(), port: portNum, password: devicePassword },
      });
      setDevicePassword('');
      await refreshStatus();
      toast.success(t('savedDevice'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function changePrintMode(next: PrintMode) {
    if (next === printMode) {
      return;
    }
    const prev = printMode;
    setPrintMode(next); // optimistic; revert on failure
    try {
      await printModeMut.mutateAsync({
        restaurantId,
        branchId,
        data: { fiscalPrintMode: next },
      });
      await refreshStatus();
      toast.success(t('savedPrintMode'));
    } catch (err) {
      setPrintMode(prev);
      toast.error(getErrorMessage(err));
    }
  }

  async function runCheck() {
    setCheckResult(null);
    try {
      const res = await checkMut.mutateAsync({ restaurantId, branchId });
      setCheckResult(res.ok ? 'ok' : 'fail');
      await refreshStatus();
    } catch (err) {
      setCheckResult('fail');
      toast.error(getErrorMessage(err));
    }
  }

  async function readFileInto(file: File | undefined, set: (v: string) => void) {
    if (!file) {
      return;
    }
    set(await file.text());
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Tenant picker */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">{t('org')}</span>
            <select
              className={inputClass}
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setRestaurantId('');
                setBranchId('');
              }}
            >
              <option value="">{t('selectOrg')}</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">{t('restaurant')}</span>
            <select
              className={inputClass}
              value={restaurantId}
              disabled={orgId === ''}
              onChange={(e) => {
                setRestaurantId(e.target.value);
                setBranchId('');
              }}
            >
              <option value="">{t('selectRestaurant')}</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">{t('branch')}</span>
            <select
              className={inputClass}
              value={branchId}
              disabled={restaurantId === ''}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">{t('selectBranch')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.isDefault ? ` (${t('defaultBranch')})` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!branchSelected ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          {t('pickBranchPrompt')}
        </p>
      ) : (
        <>
          {/* Config form */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('configSection')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-gray-600">{t('crn')}</span>
                <input className={inputClass} value={crn} onChange={(e) => setCrn(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-gray-600">{t('cashierId')}</span>
                <input
                  className={inputClass}
                  value={cashierId}
                  onChange={(e) => setCashierId(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-gray-600">{t('environment')}</span>
                <select
                  className={inputClass}
                  value={environment}
                  onChange={(e) =>
                    setEnvironment(e.target.value as UpsertFiscalConfigDtoEnvironment)
                  }
                >
                  <option value="TEST">{t('envTest')}</option>
                  <option value="PROD">{t('envProd')}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-gray-600">{t('language')}</span>
                <select
                  className={inputClass}
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as UpsertFiscalConfigDtoLanguage)}
                >
                  <option value="hy">hy</option>
                  <option value="en">en</option>
                  <option value="ru">ru</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              {t('active')}
            </label>
            <p className="text-xs text-gray-500">{t('activationHint')}</p>
            <div>
              <Button variant="primary" onClick={saveConfig} disabled={upsertMut.isPending}>
                {t('saveConfig')}
              </Button>
            </div>
          </section>

          {/* Department map */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('deptSection')}</h2>
            {!configExists ? (
              <p className="text-sm text-gray-500">{t('saveConfigFirst')}</p>
            ) : (
              <>
                {depts.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('noDepts')}</p>
                ) : (
                  <div className="space-y-2">
                    {depts.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                        <input
                          className={inputClass}
                          placeholder={t('dep')}
                          value={row.dep}
                          onChange={(e) =>
                            setDepts((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, dep: e.target.value } : r)),
                            )
                          }
                        />
                        <input
                          className={inputClass}
                          placeholder={t('taxRegime')}
                          value={row.taxRegime}
                          onChange={(e) =>
                            setDepts((rows) =>
                              rows.map((r, j) =>
                                j === i ? { ...r, taxRegime: e.target.value } : r,
                              ),
                            )
                          }
                        />
                        <input
                          className={inputClass}
                          placeholder={t('label')}
                          value={row.label}
                          onChange={(e) =>
                            setDepts((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)),
                            )
                          }
                        />
                        <button
                          type="button"
                          className="text-sm text-red-600"
                          onClick={() => setDepts((rows) => rows.filter((_, j) => j !== i))}
                        >
                          {t('remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setDepts((rows) => [...rows, { dep: '', taxRegime: '', label: '' }])
                    }
                  >
                    {t('addRow')}
                  </Button>
                  <Button variant="primary" onClick={saveDepts} disabled={deptsMut.isPending}>
                    {t('saveDepts')}
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* Cert (write-only) */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{t('certSection')}</h2>
              {status?.certConfigured ? (
                <Badge tone="green">{t('certConfigured')}</Badge>
              ) : (
                <Badge tone="amber">{t('certNotConfigured')}</Badge>
              )}
            </div>
            {!configExists ? (
              <p className="text-sm text-gray-500">{t('saveConfigFirst')}</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">{t('certHint')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-gray-600">{t('certFile')}</span>
                    <input
                      type="file"
                      className="text-sm"
                      accept=".pem,.crt,.cer,.p12,.pfx,text/plain"
                      onChange={(e) => void readFileInto(e.target.files?.[0], setCertPem)}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-gray-600">{t('keyFile')}</span>
                    <input
                      type="file"
                      className="text-sm"
                      accept=".pem,.key,text/plain"
                      onChange={(e) => void readFileInto(e.target.files?.[0], setKeyPem)}
                    />
                  </label>
                </div>
                <Button
                  variant="primary"
                  onClick={uploadCert}
                  disabled={certMut.isPending || certPem === '' || keyPem === ''}
                >
                  {t('uploadCert')}
                </Button>
              </>
            )}
          </section>

          {/* Physical-HDM device (write-only password, mirrors cert) */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{t('deviceSection')}</h2>
              {status?.deviceConfigured ? (
                <Badge tone="green">{t('deviceConfigured')}</Badge>
              ) : (
                <Badge tone="amber">{t('deviceNotConfigured')}</Badge>
              )}
            </div>
            {!configExists ? (
              <p className="text-sm text-gray-500">{t('saveConfigFirst')}</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">{t('deviceHint')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-gray-600">{t('deviceHost')}</span>
                    <input
                      className={inputClass}
                      value={deviceHost}
                      onChange={(e) => setDeviceHost(e.target.value)}
                      placeholder="192.168.1.50"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-gray-600">{t('devicePort')}</span>
                    <input
                      className={inputClass}
                      type="number"
                      min={1}
                      max={65535}
                      value={devicePort}
                      onChange={(e) => setDevicePort(e.target.value)}
                      placeholder="8080"
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block text-gray-600">{t('devicePassword')}</span>
                    <input
                      className={inputClass}
                      type="password"
                      autoComplete="new-password"
                      value={devicePassword}
                      onChange={(e) => setDevicePassword(e.target.value)}
                      placeholder={status?.deviceConfigured ? t('devicePasswordSet') : ''}
                    />
                  </label>
                </div>
                <Button
                  variant="primary"
                  onClick={saveDevice}
                  disabled={
                    deviceMut.isPending ||
                    deviceHost.trim() === '' ||
                    devicePort === '' ||
                    devicePassword === ''
                  }
                >
                  {t('saveDevice')}
                </Button>
              </>
            )}
          </section>

          {/* Print mode (AUTO / MANUAL) */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('printModeSection')}</h2>
            {!configExists ? (
              <p className="text-sm text-gray-500">{t('saveConfigFirst')}</p>
            ) : (
              <>
                <p className="text-xs text-gray-500">{t('printModeHint')}</p>
                <div className="flex gap-2">
                  <Button
                    variant={printMode === 'AUTO' ? 'primary' : 'secondary'}
                    onClick={() => changePrintMode('AUTO')}
                    disabled={printModeMut.isPending}
                  >
                    {t('printModeAuto')}
                  </Button>
                  <Button
                    variant={printMode === 'MANUAL' ? 'primary' : 'secondary'}
                    onClick={() => changePrintMode('MANUAL')}
                    disabled={printModeMut.isPending}
                  >
                    {t('printModeManual')}
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* Test connection */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('testSection')}</h2>
            <p className="text-xs text-gray-500">{t('testHint')}</p>
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={runCheck} disabled={checkMut.isPending || !configExists}>
                {t('testConnection')}
              </Button>
              {checkResult === 'ok' ? (
                <Badge tone="green">{t('testOk')}</Badge>
              ) : checkResult === 'fail' ? (
                <Badge tone="amber">{t('testFail')}</Badge>
              ) : null}
            </div>
            {status?.lastCheckConnectionAt ? (
              <p className="text-xs text-gray-500">
                {t('lastChecked')}: {new Date(status.lastCheckConnectionAt).toLocaleString()} —{' '}
                {status.lastCheckConnectionOk ? t('testOk') : t('testFail')}
              </p>
            ) : null}
          </section>

          {/* Health — only what the cloud can honestly verify */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">{t('healthSection')}</h2>
            <div className="space-y-2 text-sm">
              {/* e-HDM connection (SRC), from the test-connection result */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">{t('healthEhdm')}</span>
                {status?.lastCheckConnectionAt == null ? (
                  <Badge tone="gray">{t('healthNotChecked')}</Badge>
                ) : status.lastCheckConnectionOk ? (
                  <Badge tone="green">{t('testOk')}</Badge>
                ) : (
                  <Badge tone="amber">{t('testFail')}</Badge>
                )}
              </div>
              {/* Physical device — "Configured", NOT "Connected": the cloud
                  cannot live-ping the LAN device. */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">
                  {t('healthDevice')}
                  {status?.deviceConfigured && status.deviceHost ? (
                    <span className="ml-1 text-gray-400">
                      ({status.deviceHost}
                      {status.devicePort != null ? `:${status.devicePort}` : ''})
                    </span>
                  ) : null}
                </span>
                {status?.deviceConfigured ? (
                  <Badge tone="green">{t('deviceConfigured')}</Badge>
                ) : (
                  <Badge tone="amber">{t('deviceNotConfigured')}</Badge>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">{t('healthNote')}</p>
          </section>
        </>
      )}
    </div>
  );
}
