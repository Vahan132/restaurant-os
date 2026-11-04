'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { customInstance } from '@/api/mutator';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import { makeStoreZip } from '@/lib/hubs/zip';
import { toast } from '@/stores/toast';

interface ProvisionFile {
  path: string;
  content: string;
}
interface ProvisionResponse {
  nodeId: string;
  branchId: string;
  name: string;
  bundleName: string;
  files: ProvisionFile[];
}

/**
 * Self-service hub provisioning: pick a branch + name, and download a ready-to-run
 * package (filled .env.edge + run scripts). The operator unzips and runs it once —
 * the hub boots already paired and every device it serves is accepted with no
 * enrollment. No codes, no copy/paste, no file editing.
 */
export function DownloadHubModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('hubs');
  const tc = useTranslations('common');
  const { accessibleBranches, activeBranchId } = useBranchContext();

  const [branchId, setBranchId] = useState(activeBranchId ?? accessibleBranches[0]?.id ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (!branchId) {
      setError(t('validation.branchRequired'));
      return;
    }
    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const cloudUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/res/api` : undefined;
      const res = await customInstance<ProvisionResponse>({
        url: '/edge-nodes/provision',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        data: { branchId, name: name.trim(), cloudUrl },
      });
      const blob = makeStoreZip(res.files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.bundleName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('toast.downloaded'));
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={t('downloadTitle')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={download} disabled={busy}>
            {busy ? t('preparing') : t('download')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">{t('downloadIntro')}</p>
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
        <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
          <span className="block text-sm font-medium text-gray-700">
            {t('instructionsTitle')}
          </span>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
            <li>{t('dlStep1')}</li>
            <li>{t('dlStep2')}</li>
            <li>{t('dlStep3')}</li>
          </ol>
        </div>
      </div>
    </Modal>
  );
}
