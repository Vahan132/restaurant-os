'use client';

import { RouteGuard } from '@/components/RouteGuard';
import { NoKitchenAccess } from '@/components/NoKitchenAccess';
import { KioskShell } from '@/components/KioskShell';
import { StationPicker } from '@/components/StationPicker';
import { TicketBoard } from '@/components/board/TicketBoard';
import { PERMISSIONS, usePermission } from '@/lib/auth/permissions';
import { useStationStore } from '@/lib/station/store';
import { useRealtimeConnection } from '@/lib/realtime/useRealtime';

export default function HomePage() {
  return (
    <RouteGuard>
      <KioskHome />
    </RouteGuard>
  );
}

function KioskHome() {
  // Connect realtime once authenticated; status drives the banner/indicator.
  const { status } = useRealtimeConnection();
  const canAccessKds = usePermission(PERMISSIONS.KDS_ACCESS);
  const stations = useStationStore((s) => s.stations);
  const hydrated = useStationStore((s) => s.hydrated);

  // Gate: a user without KDS_ACCESS can never reach the board.
  if (!canAccessKds) {
    return <NoKitchenAccess />;
  }

  // Wait for the persisted station selection to load before deciding.
  if (!hydrated) {
    return null;
  }

  return (
    <KioskShell status={status}>
      {stations.length === 0 ? <StationPicker /> : <TicketBoard />}
    </KioskShell>
  );
}
