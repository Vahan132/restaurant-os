/**
 * Setup / pairing screen (R-AND-1 §2).
 *
 * Collects the API base URL + device token (pasted from the admin Devices
 * screen), runs "Test connection" against the ingest endpoint with an empty
 * batch, and only allows pairing once entries are present. A 401 surfaces a
 * "token revoked / wrong" message; a 200 confirms validity.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { normalizeBaseUrl } from '../api/client';
import { getSyncManager } from '../sync/syncManager';
import { IngestResult } from '../types';
import { colors, styles } from './theme';

interface Props {
  initialBaseUrl?: string;
  onPaired: () => void;
  onCancel?: () => void;
}

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'result'; result: IngestResult };

function describe(result: IngestResult): { ok: boolean; text: string } {
  switch (result.kind) {
    case 'ok':
      return { ok: true, text: 'Connection OK — token is valid.' };
    case 'unauthorized':
      return { ok: false, text: 'Unauthorized (401) — token is wrong or revoked.' };
    case 'network-error':
      return { ok: false, text: `Network error: ${result.message}` };
    case 'server-error':
      return { ok: false, text: `Server error (HTTP ${result.status}): ${result.message}` };
  }
}

export function SetupScreen({ initialBaseUrl, onPaired, onCancel }: Props) {
  const manager = getSyncManager();
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl ?? '');
  const [token, setToken] = useState('');
  const [test, setTest] = useState<TestState>({ kind: 'idle' });

  const canSubmit = baseUrl.trim().length > 0 && token.trim().length > 0;

  const runTest = async () => {
    if (!canSubmit) return;
    setTest({ kind: 'testing' });
    const result = await manager.testConnection({
      baseUrl: normalizeBaseUrl(baseUrl),
      deviceToken: token.trim(),
    });
    setTest({ kind: 'result', result });
  };

  const pair = async () => {
    if (!canSubmit) return;
    await manager.pair({
      baseUrl: normalizeBaseUrl(baseUrl),
      deviceToken: token.trim(),
    });
    onPaired();
  };

  const testInfo = test.kind === 'result' ? describe(test.result) : null;
  const testPassed = test.kind === 'result' && test.result.kind === 'ok';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Pair device</Text>
        <Text style={styles.p}>
          Enter the API base URL and the device token from the admin Devices screen.
          Test the connection, then pair.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>API base URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://api.your-restaurant.com"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={baseUrl}
            onChangeText={(t) => {
              setBaseUrl(t);
              setTest({ kind: 'idle' });
            }}
          />

          <Text style={styles.label}>Device token</Text>
          <TextInput
            style={[styles.input, { minHeight: 72 }]}
            placeholder="Paste device token"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            value={token}
            onChangeText={(t) => {
              setToken(t);
              setTest({ kind: 'idle' });
            }}
          />

          <TouchableOpacity
            style={[styles.buttonGhost, !canSubmit && { opacity: 0.5 }]}
            disabled={!canSubmit || test.kind === 'testing'}
            onPress={runTest}
          >
            {test.kind === 'testing' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.buttonGhostText}>Test connection</Text>
            )}
          </TouchableOpacity>

          {testInfo && (
            <Text
              style={[
                styles.p,
                { color: testInfo.ok ? colors.success : colors.danger, fontWeight: '600' },
              ]}
            >
              {testInfo.text}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, (!canSubmit || !testPassed) && { opacity: 0.5 }]}
          disabled={!canSubmit || !testPassed}
          onPress={pair}
        >
          <Text style={styles.buttonText}>Pair this device</Text>
        </TouchableOpacity>
        {!testPassed && (
          <Text style={[styles.p, { textAlign: 'center' }]}>
            Run a successful connection test to enable pairing.
          </Text>
        )}

        {onCancel && (
          <TouchableOpacity style={styles.buttonGhost} onPress={onCancel}>
            <Text style={styles.buttonGhostText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
