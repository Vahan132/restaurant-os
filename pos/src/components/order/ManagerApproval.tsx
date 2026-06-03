'use client';

import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { verifyManager } from '@/lib/approval';

/**
 * Reusable manager-approval flow. Whenever a settings toggle requires approval,
 * call `requestApproval(permission)` — it opens a modal asking a manager to
 * authenticate, verifies (transiently) that they hold `permission`, and resolves
 * with their user id (to send as `approvedByUserId`) or `null` if cancelled.
 *
 * Reused by P5 (payment/void approvals).
 */
export function useManagerApproval() {
  const [state, setState] = useState<{ permission: string } | null>(null);
  const resolverRef = useRef<((userId: string | null) => void) | null>(null);

  const requestApproval = useCallback((permission: string) => {
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      setState({ permission });
    });
  }, []);

  const finish = useCallback((userId: string | null) => {
    resolverRef.current?.(userId);
    resolverRef.current = null;
    setState(null);
  }, []);

  const ApprovalModal = state ? (
    <ManagerApprovalModal
      permission={state.permission}
      onApproved={(userId) => finish(userId)}
      onCancel={() => finish(null)}
    />
  ) : null;

  return { requestApproval, ApprovalModal };
}

function ManagerApprovalModal({
  permission,
  onApproved,
  onCancel,
}: {
  permission: string;
  onApproved: (userId: string) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('approval');
  const tc = useTranslations('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifying(true);
    const result = await verifyManager(email, password, permission);
    setVerifying(false);
    if (result.ok) {
      onApproved(result.userId);
    } else {
      setError(result.reason === 'BAD_CREDENTIALS' ? t('badCredentials') : t('missingPermission'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="mt-1 text-base text-gray-500">{t('subtitle')}</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <input
            type="email"
            autoComplete="off"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('email')}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900"
          />
          <input
            type="password"
            autoComplete="off"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('password')}
            className="h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-gray-900"
          />
          {error ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-base font-medium text-red-700">{error}</p>
          ) : null}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-14 flex-1 select-none rounded-xl border border-gray-300 text-lg font-semibold text-gray-700 active:scale-[0.98]"
            >
              {tc('cancel')}
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="h-14 flex-1 select-none rounded-xl bg-gray-900 text-lg font-bold text-white active:scale-[0.98] disabled:opacity-60"
            >
              {verifying ? t('verifying') : t('verify')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
