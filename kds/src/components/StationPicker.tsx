'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { Station } from '@/lib/realtime/client';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useAuthStore } from '@/lib/auth/store';
import { useBranchStore } from '@/lib/branch/store';
import { ALL_STATIONS, useStationStore } from '@/lib/station/store';
import { isHubTarget, useEndpointStore } from '@/lib/endpoint/store';
import { EndpointConfig } from './EndpointConfig';

/**
 * Full-screen setup: pin this device to a branch AND a station. Both persist so
 * the kiosk returns to the same board after a reload. Only branches where the
 * caller actually has KDS access are offered (from /auth/me). The branch step is
 * shown ONLY when there is more than one such branch; with exactly one it is
 * auto-selected silently and the user just picks a station.
 */
export function StationPicker() {
  const t = useTranslations('setup');
  const tStation = useTranslations('station');
  const setBranch = useBranchStore((s) => s.setBranch);
  const setStation = useStationStore((s) => s.setStation);

  const allBranches = useAuthStore((s) => s.allBranches);
  const restaurantPermissions = useAuthStore((s) => s.permissions);
  const accessibleBranches = useAuthStore((s) => s.accessibleBranches);

  // Branches this user can run the KDS at (restaurant-wide callers: all of them).
  const branches = useMemo(
    () =>
      accessibleBranches.filter((b) =>
        (allBranches ? restaurantPermissions : b.permissions).includes(
          PERMISSIONS.KDS_ACCESS,
        ),
      ),
    [accessibleBranches, allBranches, restaurantPermissions],
  );

  // Device endpoint (cloud or local hub) must be valid before starting: a hub
  // device needs its LAN base URL filled in.
  const endpointTarget = useEndpointStore((s) => s.target);
  const hubBaseUrl = useEndpointStore((s) => s.hubBaseUrl);
  const endpointReady =
    endpointTarget === 'CLOUD' || isHubTarget({ target: endpointTarget, hubBaseUrl });

  const [branchId, setBranchId] = useState<string | null>(null);
  const [station, setSelectedStation] = useState<Station | null>(null);

  // Preselect when there is exactly one KDS-capable branch.
  const onlyBranch = branches.length === 1 ? branches[0] : undefined;
  useEffect(() => {
    if (branchId === null && onlyBranch) {
      setBranchId(onlyBranch.id);
    }
  }, [branchId, onlyBranch]);

  function confirm() {
    const branch = branches.find((b) => b.id === branchId);
    if (!branch || !station) return;
    setBranch(branch.id, branch.name);
    setStation(station);
  }

  if (branches.length === 0) {
    return <Centered>{t('noBranches')}</Centered>;
  }

  const showBranchStep = branches.length > 1;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-8 py-12">
      <div className="text-center">
        <h1 className="text-kiosk-xl font-bold">{t('title')}</h1>
        <p className="mt-2 text-kiosk text-kiosk-muted">
          {showBranchStep ? t('hint') : t('stationOnlyHint')}
        </p>
      </div>

      {showBranchStep && (
        <Section label={t('branchLabel')}>
          {branches.map((branch) => (
            <Tile
              key={branch.id}
              active={branch.id === branchId}
              onClick={() => setBranchId(branch.id)}
            >
              {branch.name}
            </Tile>
          ))}
        </Section>
      )}

      <Section label={t('stationLabel')}>
        {ALL_STATIONS.map((s) => (
          <Tile key={s} active={s === station} onClick={() => setSelectedStation(s)}>
            {tStation(s)}
          </Tile>
        ))}
      </Section>

      <EndpointConfig />

      <button
        type="button"
        disabled={!branchId || !station || !endpointReady}
        onClick={confirm}
        className="rounded-xl bg-status-ready px-12 py-5 text-kiosk-lg font-bold text-black disabled:opacity-40"
      >
        {t('confirm')}
      </button>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-kiosk text-kiosk-muted">{label}</span>
      <div className="flex flex-wrap justify-center gap-6">{children}</div>
    </div>
  );
}

function Tile({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-32 w-64 rounded-2xl border-4 px-4 text-kiosk-lg font-bold transition-colors ${
        active
          ? 'border-status-sent bg-status-sent/20 text-kiosk-text'
          : 'border-kiosk-border bg-kiosk-panel text-kiosk-muted hover:border-kiosk-muted'
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 px-8 text-center text-kiosk-lg text-kiosk-muted">
      {children}
    </div>
  );
}
