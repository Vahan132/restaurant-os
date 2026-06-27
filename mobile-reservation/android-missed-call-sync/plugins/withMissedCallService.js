/**
 * Expo config plugin (R-AND-1).
 *
 * Notifee declares a foreground service component (`app.notifee.core.ForegroundService`)
 * in its own AndroidManifest. On Android 14 (API 34+) every foreground service must
 * declare an `android:foregroundServiceType`, and the matching runtime permission must
 * be granted. This plugin:
 *
 *   1. Guarantees the required permissions are present in the merged manifest.
 *   2. Forces the notifee ForegroundService component to declare
 *      android:foregroundServiceType="dataSync" so our "Syncing missed calls"
 *      service is allowed to run on Android 14+.
 *
 * Apply via app.json -> plugins. Re-run `expo prebuild --clean` after changing it.
 */
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

const NOTIFEE_SERVICE = 'app.notifee.core.ForegroundService';

const REQUIRED_PERMISSIONS = [
  'android.permission.READ_CALL_LOG',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

const withMissedCallService = (config, props = {}) => {
  const serviceType = props.foregroundServiceType || 'dataSync';

  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // 1. Ensure permissions.
    AndroidConfig.Permissions.ensurePermissions(manifest, REQUIRED_PERMISSIONS);

    const application = manifest.manifest.application?.[0];
    if (!application) {
      throw new Error('withMissedCallService: <application> not found in AndroidManifest.');
    }
    application.service = application.service || [];

    // 2. Find (or create) the notifee foreground service and stamp the type.
    let service = application.service.find(
      (s) => s?.$?.['android:name'] === NOTIFEE_SERVICE
    );

    if (!service) {
      service = { $: { 'android:name': NOTIFEE_SERVICE } };
      application.service.push(service);
    }

    service.$['android:foregroundServiceType'] = serviceType;
    service.$['android:exported'] = 'false';
    service.$['android:stopWithTask'] = 'false';

    return cfg;
  });
};

module.exports = withMissedCallService;
