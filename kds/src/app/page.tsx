'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { NoKitchenAccess } from '@/components/NoKitchenAccess';
import { KioskShell } from '@/components/KioskShell';
import { StationPicker } from '@/components/StationPicker';
import { TicketBoard } from '@/components/board/TicketBoard';
import {
  PERMISSIONS,
  useHasPermissionAnyBranch,
  usePermission,
} from '@/lib/auth/permissions';
import { useBranchStore } from '@/lib/branch/store';
import { useStationStore } from '@/lib/station/store';
import { useConnection } from '@/lib/hub/useConnection';

export default function HomePage() {
  return (
    <RouteGuard>
      <KioskHome />
    </RouteGuard>
  );
}

function KioskHome() {
  // Connect realtime + hub health once authenticated + pinned; status drives
  // the banner and the top-strip indicator (cloud or hub-aware states).
  const { status } = useConnection();
  const branchId = useBranchStore((s) => s.branchId);
  const station = useStationStore((s) => s.station);
  const branchHydrated = useBranchStore((s) => s.hydrated);
  const stationHydrated = useStationStore((s) => s.hydrated);

  // KDS access at the PINNED branch vs. at any accessible branch.
  const canAccessKdsHere = usePermission(PERMISSIONS.KDS_ACCESS);
  const hasKdsSomewhere = useHasPermissionAnyBranch(PERMISSIONS.KDS_ACCESS);

  // Wait for the persisted pin to load before deciding what to show.
  if (!branchHydrated || !stationHydrated) {
    return null;
  }

  // No kitchen access at any branch: there is nothing to pin to.
  if (!hasKdsSomewhere) {
    return <NoKitchenAccess />;
  }

  const pinned = Boolean(branchId && station);

  return (
    <KioskShell status={status}>
      {!pinned ? (
        <StationPicker />
      ) : canAccessKdsHere ? (
        <TicketBoard />
      ) : (
        // Pinned to a branch where this user lacks KDS access — deny, but let
        // them re-pin to a branch they can use (header "Change" also re-pins).
        <NoKitchenAccess canRepin />
      )}
    </KioskShell>
  );
}
