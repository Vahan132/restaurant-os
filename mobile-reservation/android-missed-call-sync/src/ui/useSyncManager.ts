/** React binding for the SyncManager singleton. */
import { useEffect, useState } from 'react';

import { getSyncManager, ManagerSnapshot } from '../sync/syncManager';

export function useSyncManager(): ManagerSnapshot {
  const manager = getSyncManager();
  const [snap, setSnap] = useState<ManagerSnapshot>(manager.getSnapshot());

  useEffect(() => {
    const unsub = manager.subscribe(setSnap);
    void manager.init();
    return unsub;
  }, [manager]);

  return snap;
}
