'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Toggle } from '@/components/ui/toggle';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { PERMISSIONS } from '@/lib/permissions';
import {
  useCheckPaymentSettings,
  usePaymentSettings,
  useSavePaymentSettings,
  useTestPayment,
} from '@/lib/payments/paynet-settings';
import { toast } from '@/stores/toast';

/** Optional pre-selection on Paynet's checkout. Blank = buyer chooses. */
const PROCESSORS = ['', 'idram', 'telcell', 'arca', 'ameriabank', 'sandbox'];

/**
 * PAYNET-1 — "Online payments" tab: connect the restaurant's OWN Paynet merchant
 * account for QR-menu prepayment (cards/ArCa, Idram, Telcell). Per active branch.
 * Secrets are write-only (blank = keep). A sandbox test payment can be opened
 * with a sk_test_ key and Paynet's test cards.
 */
export function PaymentsTab() {
  const t = useTranslations('paymentsSettings');
  const canManage = usePermission(PERMISSIONS.SETTINGS_MANAGE); // per active branch
  const { data, isLoading } = usePaymentSettings();
  const save = useSavePaymentSettings();
  const check = useCheckPaymentSettings();
  const testPay = useTestPayment();
  const status = data?.status ?? null;

  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [domain, setDomain] = useState('');
  const [processor, setProcessor] = useState('');
  const [testAmount, setTestAmount] = useState('100');

  useEffect(() => {
    setEnabled(status?.enabled ?? false);
    setDomain(status?.domain ?? '');
    setProcessor(status?.processor ?? '');
    setApiKey('');
    setWebhookSecret('');
  }, [status]);

  const typedKeyLive = apiKey.trim().startsWith('sk_live_');
  const keyLooksWrong = apiKey.trim() !== '' && !/^sk_(live|test)_/.test(apiKey.trim());

  async function onSave() {
    try {
      await save.mutateAsync({
        enabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        domain: domain.trim() || null,
        processor: processor || null,
      });
      toast.success(t('saved'));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onCheck() {
    try {
      const res = await check.mutateAsync();
      if (res.ok) toast.success(res.livemode ? t('checkOkLive') : t('checkOkTest'));
      else toast.error(`${t('checkFail')}: ${res.errorMessage ?? res.errorCode ?? ''}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onTestPayment() {
    const amount = Number(testAmount);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error(t('testAmountInvalid'));
      return;
    }
    try {
      const res = await testPay.mutateAsync({ amount, returnUrl: window.location.href });
      if (res.checkoutUrl) window.open(res.checkoutUrl, '_blank', 'noopener');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text).then(() => toast.success(t('copied')));
  }

  if (isLoading) return <p className="text-sm text-gray-500">…</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
            <p className="text-xs text-gray-500">{t('subtitle')}</p>
          </div>
          <div className="flex gap-1.5">
            {status?.apiKeyConfigured ? (
              <Badge tone={status.livemode ? 'green' : 'blue'}>
                {status.livemode ? t('live') : t('sandbox')} ···{status.apiKeyLast4}
              </Badge>
            ) : (
              <Badge tone="amber">{t('notConnected')}</Badge>
            )}
            {status?.lastCheckOk === true ? <Badge tone="green">{t('checked')}</Badge> : null}
            {status?.lastCheckOk === false ? (
              <Badge tone="red">{status.lastCheckError ?? t('checkFail')}</Badge>
            ) : null}
          </div>
        </div>

        <details className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-gray-800">{t('guideTitle')}</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>{t('guide1')}</li>
            <li>{t('guide2')}</li>
            <li>{t('guide3')}</li>
            <li>{t('guide4')}</li>
            <li>{t('guide5')}</li>
          </ol>
        </details>

        <Toggle
          label={t('enabled')}
          description={t('enabledHint')}
          checked={enabled}
          disabled={!canManage}
          onChange={setEnabled}
        />

        <Field label={t('apiKey')}>
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={apiKey}
            disabled={!canManage}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status?.apiKeyConfigured ? t('secretKept') : 'sk_test_…'}
          />
        </Field>
        {keyLooksWrong ? <p className="text-xs text-red-600">{t('keyFormat')}</p> : null}
        {typedKeyLive ? <p className="text-xs text-amber-700">{t('liveWarning')}</p> : null}

        <Field label={t('webhookSecret')}>
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={webhookSecret}
            disabled={!canManage}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={status?.webhookSecretConfigured ? t('secretKept') : ''}
          />
        </Field>

        {data?.webhookUrl ? (
          <div className="text-xs">
            <span className="mb-1 block font-medium text-gray-700">{t('webhookUrl')}</span>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1">{data.webhookUrl}</code>
              <Button size="sm" onClick={() => copy(data.webhookUrl!)}>
                {t('copy')}
              </Button>
            </div>
            <p className="mt-1 text-gray-500">{t('webhookUrlHint')}</p>
          </div>
        ) : status ? (
          <p className="text-xs text-gray-500">{t('webhookUrlMissing')}</p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('domain')}>
            <input
              className={inputClass}
              value={domain}
              disabled={!canManage}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="menu.myrestaurant.am"
            />
          </Field>
          <Field label={t('processor')}>
            <select
              className={inputClass}
              value={processor}
              disabled={!canManage}
              onChange={(e) => setProcessor(e.target.value)}
            >
              {PROCESSORS.map((p) => (
                <option key={p} value={p}>
                  {p === '' ? t('processorAny') : p}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onSave} disabled={!canManage || save.isPending || keyLooksWrong}>
            {t('save')}
          </Button>
          <Button onClick={onCheck} disabled={!status?.apiKeyConfigured || check.isPending}>
            {t('check')}
          </Button>
        </div>
      </section>

      {status?.apiKeyConfigured && !status.livemode ? (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">{t('testTitle')}</h2>
          <p className="text-xs text-gray-500">{t('testHint')}</p>
          <div className="flex items-end gap-2">
            <Field label={t('testAmount')}>
              <input
                className={inputClass}
                type="number"
                min={1}
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
              />
            </Field>
            <Button onClick={onTestPayment} disabled={testPay.isPending}>
              {t('testOpen')}
            </Button>
          </div>
          <ul className="grid gap-x-4 text-xs text-gray-600 sm:grid-cols-2">
            <li><code>4111 1111 1111 1111</code> — {t('cardOk')}</li>
            <li><code>4000 0000 0000 0002</code> — {t('cardDeclined')}</li>
            <li><code>4000 0000 0000 0069</code> — {t('cardFunds')}</li>
            <li><code>4000 0000 0000 0101</code> — {t('card3ds')}</li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
