'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { useEdgeNodesControllerPairingCode } from '@/api/generated/edge-nodes/edge-nodes';
import type { IssuePairingCodeDto, PairingCodeResponse } from '@/api/generated/model';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { toast } from '@/stores/toast';

/**
 * Self-service hub pairing. The operator picks a branch + name and gets a
 * single-use pairing code, then sees EVERYTHING they must type into the hub's
 * /setup page — the server address and the code — with copy buttons and numbered
 * steps. No developer, no token files, no shell.
 */
export function PairingCodeModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('hubs');
  const tc = useTranslations('common');
  const { accessibleBranches, activeBranchId } = useBranchContext();

  const [branchId, setBranchId] = useState(
    activeBranchId ?? accessibleBranches[0]?.id ?? '',
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [result, setResult] = useState<PairingCodeResponse | null>(null);
  const [copied, setCopied] = useState<'code' | 'server' | null>(null);

  const issue = useEdgeNodesControllerPairingCode();

  // The hub pairs against the cloud API base. The admin is served from that same
  // cloud origin, so the address to type on the hub is this origin + /res/api.
  const serverAddress =
    typeof window !== 'undefined' ? `${window.location.origin}/res/api` : '';

  const copy = async (value: string, which: 'code' | 'server') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard may be unavailable; the value is still selectable on screen.
    }
  };

  const generate = async () => {
    if (!branchId) {
      setError(t('validation.branchRequired'));
      return;
    }
    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    setError(undefined);
    try {
      const data: IssuePairingCodeDto = { branchId, name: name.trim() };
      const res = await issue.mutateAsync({ data });
      setResult(res);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // ---- result: show the code + server address + steps ---------------------
  if (result) {
    const expires = new Date(result.expiresAt).toLocaleString();
    return (
      <Modal
        open
        title={t('codeResultTitle')}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            {t('tokenDone')}
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t('codeIntro')}</p>

          <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">
              {t('codeLabel')}
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-3 text-center font-mono text-2xl font-bold tracking-widest">
                {result.code}
              </code>
              <Button variant="secondary" onClick={() => copy(result.code, 'code')}>
                {copied === 'code' ? t('copied') : t('copy')}
              </Button>
            </div>
            <p className="text-xs text-amber-700">
              {t('codeExpires', { time: expires })}
            </p>
          </div>

          <div className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">
              {t('serverAddrLabel')}
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 select-all break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm">
                {serverAddress}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => copy(serverAddress, 'server')}
              >
                {copied === 'server' ? t('copied') : t('copy')}
              </Button>
            </div>
            <p className="text-xs text-gray-500">{t('serverAddrHint')}</p>
          </div>

          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
            <span className="block text-sm font-medium text-gray-700">
              {t('instructionsTitle')}
            </span>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
              <li>{t('pairStep1')}</li>
              <li>{t('pairStep2')}</li>
              <li>{t('pairStep3')}</li>
            </ol>
          </div>
        </div>
      </Modal>
    );
  }

  // ---- form: pick branch + name -------------------------------------------
  return (
    <Modal
      open
      title={t('genTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={issue.isPending}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={generate} disabled={issue.isPending}>
            {t('genSubmit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{t('genIntro')}</p>
        <Field label={t('branch')} required>
          <select
            className={inputClass}
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {accessibleBranches.length === 0 && <option value="">—</option>}
            {accessibleBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('hubName')} required error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('hubNamePlaceholder')}
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  );
}
