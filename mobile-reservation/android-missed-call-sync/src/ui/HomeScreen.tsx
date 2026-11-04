/**
 * Home / status screen (R-AND-1 §3 + §5).
 *
 * - Requests/shows READ_CALL_LOG + POST_NOTIFICATIONS; blocks the start toggle
 *   until call-log access is granted, with an explainer.
 * - Battery-optimization prompt + OEM auto-start caveat.
 * - Service indicator + start/stop, last sync, reported today/total,
 *   "Sync now", recent reported list, paired status with re-pair / unpair.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  checkPermissions,
  openAppSettings,
  openBatteryOptimizationSettings,
  PermissionStatus,
  requestPermissions,
} from '../permissions/permissions';
import { getSyncManager } from '../sync/syncManager';
import { reportedToday } from '../storage/storage';
import { ReportedCall } from '../types';
import { useSyncManager } from './useSyncManager';
import { colors, styles } from './theme';

interface Props {
  onRepair: () => void;
}

function maskToken(token: string): string {
  if (token.length <= 8) return '••••';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function StatusDot({ color }: { color: string }) {
  return (
    <View
      style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 8 }}
    />
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[styles.h2, { fontSize: 22 }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function HomeScreen({ onRepair }: Props) {
  const manager = getSyncManager();
  const snap = useSyncManager();
  const [perms, setPerms] = useState<PermissionStatus>({ callLog: false, notifications: false });

  const refreshPerms = useCallback(async () => {
    setPerms(await checkPermissions());
  }, []);

  useEffect(() => {
    void refreshPerms();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        void refreshPerms();
        // Sync on foreground (spec §4) when paired.
        if (snap.config) void manager.syncNow();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.config]);

  const onRequestPerms = async () => {
    const next = await requestPermissions();
    setPerms(next);
    if (!next.callLog) {
      // Likely permanently denied — route to settings.
      await openAppSettings();
    }
  };

  const running = snap.serviceState === 'running';
  const canStart = perms.callLog && !!snap.config;

  const toggleService = async () => {
    if (running) await manager.stop();
    else await manager.start();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Missed Call Sync</Text>

      {/* Permission gate */}
      {!perms.callLog && (
        <View style={[styles.card, { borderColor: colors.warn }]}>
          <Text style={[styles.h2, { color: colors.warn }]}>Call-log access needed</Text>
          <Text style={styles.p}>
            This app reads your phone's call log to detect missed calls and report them to
            the reservation system. It never reads message content and only sends missed-call
            numbers and times. Sync is disabled until access is granted.
          </Text>
          <TouchableOpacity style={styles.button} onPress={onRequestPerms}>
            <Text style={styles.buttonText}>Grant call-log access</Text>
          </TouchableOpacity>
        </View>
      )}

      {perms.callLog && !perms.notifications && (
        <View style={[styles.card, { borderColor: colors.warn }]}>
          <Text style={[styles.h2, { color: colors.warn }]}>Allow notifications</Text>
          <Text style={styles.p}>
            Android 13+ needs notification permission to show the persistent
            "Syncing missed calls" notification that keeps sync alive.
          </Text>
          <TouchableOpacity style={styles.buttonGhost} onPress={onRequestPerms}>
            <Text style={styles.buttonGhostText}>Allow notifications</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Service status */}
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <StatusDot color={running ? colors.success : colors.textDim} />
            <Text style={styles.h2}>{running ? 'Service running' : 'Service stopped'}</Text>
          </View>
          <TouchableOpacity
            style={[
              running ? styles.buttonGhost : styles.button,
              { paddingVertical: 10, paddingHorizontal: 18 },
              !canStart && !running ? { opacity: 0.5 } : null,
            ]}
            disabled={!canStart && !running}
            onPress={toggleService}
          >
            <Text style={running ? styles.buttonGhostText : styles.buttonText}>
              {running ? 'Stop' : 'Start'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.p}>{snap.message}</Text>

        <View style={[styles.row, { marginTop: 4 }]}>
          <Stat label="Reported today" value={reportedToday(snap.stats)} />
          <Stat label="Total reported" value={snap.stats.totalReported} />
        </View>
        <Text style={styles.label}>
          Last sync:{' '}
          {snap.stats.lastSyncAt
            ? new Date(snap.stats.lastSyncAt).toLocaleString()
            : 'never'}
        </Text>

        <TouchableOpacity
          style={[styles.buttonGhost, (!snap.config || snap.busy) && { opacity: 0.6 }]}
          disabled={!snap.config || snap.busy}
          onPress={() => manager.syncNow()}
        >
          <Text style={styles.buttonGhostText}>{snap.busy ? 'Syncing…' : 'Sync now'}</Text>
        </TouchableOpacity>
      </View>

      {/* Reliability */}
      <View style={styles.card}>
        <Text style={styles.h2}>Reliability</Text>
        <Text style={styles.p}>
          For uninterrupted background sync, disable battery optimization for this app.
          Some manufacturers (Xiaomi, Huawei, Oppo, Vivo, Samsung) also require enabling
          "Auto-start" / "Allow background activity" manually in system settings.
        </Text>
        <TouchableOpacity style={styles.buttonGhost} onPress={openBatteryOptimizationSettings}>
          <Text style={styles.buttonGhostText}>Battery optimization settings</Text>
        </TouchableOpacity>
      </View>

      {/* Paired status */}
      {snap.config && (
        <View style={styles.card}>
          <Text style={styles.h2}>Paired</Text>
          <Text style={styles.label}>Base URL</Text>
          <Text style={styles.p}>{snap.config.baseUrl}</Text>
          <Text style={styles.label}>Device token</Text>
          <Text style={styles.p}>{maskToken(snap.config.deviceToken)}</Text>

          {snap.serviceState === 'unpaired' && (
            <Text style={[styles.p, { color: colors.danger, fontWeight: '600' }]}>
              Device unpaired by admin — re-pair to resume reporting.
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={[styles.buttonGhost, { flex: 1 }]} onPress={onRepair}>
              <Text style={styles.buttonGhostText}>Re-pair</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonGhost, { flex: 1, borderColor: colors.danger }]}
              onPress={() => manager.unpair()}
            >
              <Text style={[styles.buttonGhostText, { color: colors.danger }]}>Unpair</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recent reported calls */}
      <View style={styles.card}>
        <Text style={styles.h2}>Recently reported</Text>
        {snap.stats.recent.length === 0 ? (
          <Text style={styles.p}>No missed calls reported yet.</Text>
        ) : (
          <FlatList
            scrollEnabled={false}
            data={snap.stats.recent}
            keyExtractor={(c: ReportedCall, i) => `${c.epochMs}-${i}`}
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: 8 }} />
            )}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.h2, { fontSize: 15 }]}>
                    {item.callerName || item.phoneNumber}
                  </Text>
                  {item.callerName ? <Text style={styles.label}>{item.phoneNumber}</Text> : null}
                </View>
                <Text style={styles.label}>{new Date(item.epochMs).toLocaleString()}</Text>
              </View>
            )}
          />
        )}
      </View>
    </ScrollView>
  );
}
