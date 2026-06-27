'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { useEdgeNodesControllerRevokeNode } from '@/api/generated/edge-nodes/edge-nodes';
import type {
  EdgeNodeResponse,
  RegisterEdgeNodeResponse,
} from '@/api/generated/model';
import { Can } from '@/components/auth/can';
import { HubTokenModal } from '@/components/hubs/hub-token-modal';
import { RegisterHubModal } from '@/components/hubs/register-hub-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/use-confirm';
import { getErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/lib/auth/use-permission';
import { useBranchContext } from '@/lib/branch/use-branch-context';
import {
  absoluteTime,
  deriveHubStatus,
  hubWarnings,
  relativeTime,
  statusDisplay,
} from '@/lib/hubs/status';
import { useHubs, useHubsInvalidation } from '@/lib/hubs/use-hubs-data';
import { PERMISSIONS } from '@/lib/permissions';
import { toast } from '@/stores/toast';

export function HubsManager() {
  const t = useTranslations('hubs');
  const tc = useTranslations('common');
  const locale = useLocale();
  const canManage = usePermission(PERMISSIONS.EDGE_MANAGE, 'restaurant');
  const { accessibleBranches } = useBranchContext();
  const invalidate = useHubsInvalidation();
  const { ask, dialog } = useConfirm();

  const { hubs, isLoading, isError } = useHubs();
  const revoke = useEdgeNodesControllerRevokeNode();

  const [registerOpen, setRegisterOpen] = useState(false);
  const [tokenResult, setTokenResult] = useState<RegisterEdgeNodeResponse | null>(
    null,
  );
  const [showUpdateSteps, setShowUpdateSteps] = useState(false);

  const now = Date.now();

  const branchName = (hub: EdgeNodeResponse) =>
    hub.branchName ||
    accessibleBranches.find((b) => b.id === hub.branchId)?.name ||
    hub.branchId;

  const onRevoke = async (hub: EdgeNodeResponse) => {
    const ok = await ask({
      title: tc('confirm'),
      message: t('confirmRevoke', { name: hub.name }),
      confirmLabel: t('revoke'),
      cancelLabel: tc('cancel'),
      danger: true,
    });
    if (!ok) return;
    try {
      await revoke.mutateAsync({ id: hub.id });
      toast.success(t('toast.revoked'));
      await invalidate();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const rel = (iso: string | null) => relativeTime(iso, now, locale) ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{t('title')}</h1>
        <Can permission={PERMISSIONS.EDGE_MANAGE} scope="restaurant">
          <Button variant="primary" onClick={() => setRegisterOpen(true)}>
            + {t('registerHub')}
          </Button>
        </Can>
      </div>

      <p className="text-sm text-gray-500">{t('subtitle')}</p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-red-600">{t('loadError')}</p>
        ) : hubs.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">{t('noHubs')}</p>
        ) : (
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-medium">{t('branch')}</th>
                <th className="px-4 py-2 font-medium">{t('hubName')}</th>
                <th className="px-4 py-2 font-medium">{t('status')}</th>
                <th className="px-4 py-2 font-medium">{t('lastHeartbeat')}</th>
                <th className="px-4 py-2 font-medium">{t('lastConfigSync')}</th>
                <th className="px-4 py-2 font-medium">{t('lastPush')}</th>
                <th className="px-4 py-2 font-medium">{t('pending')}</th>
                <th className="px-4 py-2 font-medium">{t('versions')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {hubs.map((hub) => {
                const revoked = !!hub.revokedAt;
                const warnings = hubWarnings(hub, now);
                const status = deriveHubStatus(hub, now);
                const sd = statusDisplay(status);
                return (
                  <tr key={hub.id} className="border-b border-gray-100 align-top">
                    <td className="px-4 py-2 text-gray-700">{branchName(hub)}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{hub.name}</td>
                    <td className="px-4 py-2">
                      {revoked ? (
                        <Badge tone="gray">{t('statusRevoked')}</Badge>
                      ) : (
                        <Badge tone={sd.tone}>{t(sd.key)}</Badge>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 ${
                        !revoked && warnings.offline ? 'text-red-600' : 'text-gray-600'
                      }`}
                      title={absoluteTime(hub.lastHeartbeatAt, locale)}
                    >
                      {rel(hub.lastHeartbeatAt)}
                    </td>
                    <td
                      className="px-4 py-2 text-gray-600"
                      title={absoluteTime(hub.lastConfigSyncedAt, locale)}
                    >
                      {rel(hub.lastConfigSyncedAt)}
                    </td>
                    <td
                      className="px-4 py-2 text-gray-600"
                      title={absoluteTime(hub.lastOperationalPushAt, locale)}
                    >
                      {rel(hub.lastOperationalPushAt)}
                    </td>
                    <td className="px-4 py-2">
                      {!revoked && warnings.backlog ? (
                        <Badge tone="amber">{t('pendingBacklog', { count: hub.pendingCount })}</Badge>
                      ) : (
                        <span className="text-gray-600">{hub.pendingCount}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      <div className="font-mono text-xs">{hub.appVersion ?? '—'}</div>
                      {!revoked && warnings.needsUpdate ? (
                        <div className="text-xs">
                          <span className="font-mono text-amber-700">
                            {hub.schemaVersion ?? '—'}
                          </span>{' '}
                          <button
                            type="button"
                            className="text-brand underline hover:opacity-80"
                            onClick={() => setShowUpdateSteps(true)}
                          >
                            {t('updateSteps')}
                          </button>
                        </div>
                      ) : (
                        <div className="font-mono text-xs text-gray-400">
                          {hub.schemaVersion ?? '—'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <Can permission={PERMISSIONS.EDGE_MANAGE} scope="restaurant">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onRevoke(hub)}
                            disabled={revoked || revoke.isPending}
                            title={revoked ? t('alreadyRevoked') : undefined}
                          >
                            {t('revoke')}
                          </Button>
                        </div>
                      </Can>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!canManage && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          {t('readOnly')}
        </p>
      )}

      {registerOpen && (
        <RegisterHubModal
          onClose={() => setRegisterOpen(false)}
          onRegistered={(result) => {
            setRegisterOpen(false);
            setTokenResult(result);
            void invalidate();
          }}
        />
      )}

      {tokenResult && (
        <HubTokenModal result={tokenResult} onClose={() => setTokenResult(null)} />
      )}

      {showUpdateSteps && (
        <Modal
          open
          title={t('updateStepsTitle')}
          onClose={() => setShowUpdateSteps(false)}
          footer={
            <Button variant="primary" onClick={() => setShowUpdateSteps(false)}>
              {tc('close')}
            </Button>
          }
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-600">{t('updateStepsIntro')}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
              <li>{t('updateStep1')}</li>
              <li>{t('updateStep2')}</li>
              <li>{t('updateStep3')}</li>
            </ol>
          </div>
        </Modal>
      )}

      {dialog}
    </div>
  );
}
