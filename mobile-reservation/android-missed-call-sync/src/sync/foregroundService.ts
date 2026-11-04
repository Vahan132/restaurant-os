/**
 * Notifee foreground-service registration (R-AND-1 §4).
 *
 * Imported once from index.ts BEFORE the app mounts. notifee requires the
 * runner to be registered at startup; the runner's returned promise stays
 * pending for the lifetime of the service, which is what keeps the process
 * alive while backgrounded. The actual sync loop lives in syncManager; this
 * file only wires the service runner to it.
 */
import notifee, { AndroidImportance } from '@notifee/react-native';

import { getSyncManager } from './syncManager';

export const FG_CHANNEL_ID = 'missed-call-sync';
export const FG_NOTIFICATION_ID = 'missed-call-sync-fg';

let channelEnsured = false;

export async function ensureChannel(): Promise<void> {
  if (channelEnsured) return;
  await notifee.createChannel({
    id: FG_CHANNEL_ID,
    name: 'Missed Call Sync',
    importance: AndroidImportance.LOW, // quiet, persistent
  });
  channelEnsured = true;
}

// Register the long-running foreground-service task. notifee calls this when a
// notification with `asForegroundService: true` is displayed.
notifee.registerForegroundService(() => {
  return new Promise<void>((resolve) => {
    // The manager drives the polling loop and calls `resolve` (via the stop
    // signal) when the service is told to stop.
    getSyncManager().attachForegroundService(resolve);
  });
});

/** Display the persistent notification that promotes the app to a FG service. */
export async function startForegroundNotification(body: string): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: FG_NOTIFICATION_ID,
    title: 'Syncing missed calls',
    body,
    android: {
      channelId: FG_CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      onlyAlertOnce: true,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
  });
}

/** Update the FG notification text (e.g. last sync time / counts). */
export async function updateForegroundNotification(body: string): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: FG_NOTIFICATION_ID,
    title: 'Syncing missed calls',
    body,
    android: {
      channelId: FG_CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      onlyAlertOnce: true,
      smallIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
  });
}

export async function stopForegroundNotification(): Promise<void> {
  await notifee.stopForegroundService();
  await notifee.cancelNotification(FG_NOTIFICATION_ID).catch(() => undefined);
}
