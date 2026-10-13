/**
 * Android runtime permissions + battery-optimization flow (R-AND-1 §3).
 *
 * - READ_CALL_LOG        : required to read the call log. Sync is blocked until granted.
 * - POST_NOTIFICATIONS   : required on Android 13+ for the foreground-service notification.
 * - Battery optimization : not a runtime permission; we deep-link the user to the
 *                          system settings so they can exempt the app for reliability.
 */
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export interface PermissionStatus {
  callLog: boolean;
  notifications: boolean;
}

const sdkInt = (): number =>
  typeof Platform.Version === 'number' ? Platform.Version : parseInt(`${Platform.Version}`, 10) || 0;

/** Notifications only need an explicit grant on Android 13 (API 33)+. */
function notificationsRequired(): boolean {
  return Platform.OS === 'android' && sdkInt() >= 33;
}

export async function checkPermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return { callLog: false, notifications: false };
  }
  const callLog = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
  );
  const notifications = notificationsRequired()
    ? await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      )
    : true;
  return { callLog, notifications };
}

/**
 * Request both permissions. Returns the resulting status. If the user has
 * permanently denied (never_ask_again), the caller should route them to
 * app settings via openAppSettings().
 */
export async function requestPermissions(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return { callLog: false, notifications: false };
  }

  const toRequest: string[] = [PermissionsAndroid.PERMISSIONS.READ_CALL_LOG];
  if (notificationsRequired()) {
    toRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  const result = await PermissionsAndroid.requestMultiple(toRequest as never);

  const granted = (p: string): boolean =>
    result[p as keyof typeof result] === PermissionsAndroid.RESULTS.GRANTED;

  return {
    callLog: granted(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG),
    notifications: notificationsRequired()
      ? granted(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
      : true,
  };
}

/** Open this app's system settings page (for permanently-denied permissions). */
export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}

/**
 * Open the system "ignore battery optimizations" flow. We try the dedicated
 * request intent first; if the OEM blocks it we fall back to the general
 * battery-optimization settings list.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
    );
  } catch {
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.APPLICATION_DETAILS_SETTINGS',
        { data: 'package:com.restaurantos.missedcallsync' }
      );
    } catch {
      await Linking.openSettings();
    }
  }
}
