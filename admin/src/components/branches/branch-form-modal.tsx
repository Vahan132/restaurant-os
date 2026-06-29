'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  useBranchesControllerCreate,
  useBranchesControllerUpdate,
} from '@/api/generated/branches/branches';
import {
  BranchResponseIpBindingMode,
  type BranchResponse,
  type CreateBranchDto,
  type UpdateBranchDto,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, inputClass } from '@/components/ui/form';
import { Modal } from '@/components/ui/modal';
import { getErrorMessage } from '@/lib/api-error';
import { useBranchesAdminInvalidation } from '@/lib/branch/use-branches-admin';
import { toast } from '@/stores/toast';

// IPv4 address with an optional /0–32 CIDR suffix. Bare IPv4 is allowed too.
// The backend is authoritative; this only catches obvious typos client-side.
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

export function BranchFormModal({
  branch,
  onClose,
}: {
  branch?: BranchResponse | null;
  onClose: () => void;
}) {
  const t = useTranslations('branch');
  const tc = useTranslations('common');
  const invalidate = useBranchesAdminInvalidation();
  const isEdit = !!branch;

  const [name, setName] = useState(branch?.name ?? '');
  const [error, setError] = useState<string | undefined>();

  // 3A IP policy (edit only — new branches default to SOFT with no allowlist).
  const [ipMode, setIpMode] = useState<BranchResponseIpBindingMode>(
    branch?.ipBindingMode ?? BranchResponseIpBindingMode.SOFT,
  );
  const [allowlist, setAllowlist] = useState<string[]>(branch?.ipAllowlist ?? []);
  const [cidrDraft, setCidrDraft] = useState('');
  const [cidrError, setCidrError] = useState<string>();

  const create = useBranchesControllerCreate();
  const update = useBranchesControllerUpdate();
  const submitting = create.isPending || update.isPending;

  const addCidr = () => {
    const value = cidrDraft.trim();
    if (!value) return;
    if (!CIDR_RE.test(value)) {
      setCidrError(t('validation.invalidCidr'));
      return;
    }
    if (allowlist.includes(value)) {
      setCidrError(t('validation.duplicateCidr'));
      return;
    }
    setAllowlist((prev) => [...prev, value]);
    setCidrDraft('');
    setCidrError(undefined);
  };

  const removeCidr = (value: string) => {
    setAllowlist((prev) => prev.filter((c) => c !== value));
  };

  const save = async () => {
    if (!name.trim()) {
      setError(t('validation.nameRequired'));
      return;
    }
    try {
      if (isEdit && branch) {
        const data: UpdateBranchDto = {
          name: name.trim(),
          ipBindingMode: ipMode,
          ipAllowlist: allowlist,
        };
        await update.mutateAsync({ id: branch.id, data });
        toast.success(t('toast.updated'));
      } else {
        const data: CreateBranchDto = { name: name.trim() };
        await create.mutateAsync({ data });
        toast.success(t('toast.created'));
      }
      await invalidate();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isStrict = ipMode === BranchResponseIpBindingMode.STRICT;

  return (
    <Modal
      open
      title={isEdit ? t('editBranch') : t('addBranch')}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {tc('cancel')}
          </Button>
          <Button variant="primary" onClick={save} disabled={submitting}>
            {isEdit ? tc('save') : tc('create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('branchName')} required error={error}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>

        {isEdit && (
          <section className="space-y-3 border-t border-gray-200 pt-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t('ipPolicy')}</h3>
              <p className="mt-1 text-xs text-gray-500">{t('ipPolicyIntro')}</p>
            </div>

            <Field label={t('ipMode')}>
              <select
                className={inputClass}
                value={ipMode}
                onChange={(e) => setIpMode(e.target.value as BranchResponseIpBindingMode)}
              >
                <option value={BranchResponseIpBindingMode.SOFT}>{t('ipModeSoft')}</option>
                <option value={BranchResponseIpBindingMode.STRICT}>{t('ipModeStrict')}</option>
              </select>
            </Field>

            <p
              className={`rounded-md border px-3 py-2 text-xs ${
                isStrict
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              {isStrict ? t('ipStrictWarning') : t('ipSoftHint')}
            </p>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-gray-700">{t('ipAllowlist')}</span>
              <p className="text-xs text-gray-500">{t('ipAllowlistHint')}</p>

              {allowlist.length === 0 ? (
                <p className="text-xs text-gray-400">{t('ipAllowlistEmpty')}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {allowlist.map((cidr) => (
                    <li key={cidr}>
                      <Badge tone="blue">
                        <span className="font-mono">{cidr}</span>
                        <button
                          type="button"
                          onClick={() => removeCidr(cidr)}
                          aria-label={t('remove', { cidr })}
                          className="ml-1 text-blue-700 hover:text-blue-900"
                        >
                          ×
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    className={inputClass}
                    placeholder={t('cidrPlaceholder')}
                    value={cidrDraft}
                    onChange={(e) => setCidrDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCidr();
                      }
                    }}
                  />
                  {cidrError && <span className="mt-1 block text-xs text-red-600">{cidrError}</span>}
                </div>
                <Button variant="secondary" onClick={addCidr}>
                  {t('addCidr')}
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
