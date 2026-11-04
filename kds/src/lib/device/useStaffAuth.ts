'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance, NormalizedError } from '@/api/mutator';
import { AuthUser, BranchAccess, useAuthStore } from '@/lib/auth/store';
import { EnrollDeviceDtoSurface } from '@/api/generated/model/enrollDeviceDtoSurface';
import type { DeviceEnrolledResponse } from '@/api/generated/model/deviceEnrolledResponse';
import type { PinLoginResponse } from '@/api/generated/model/pinLoginResponse';
import type { StaffPickerEntryResponse } from '@/api/generated/model/staffPickerEntryResponse';
import { getDeviceSecret, persistEnrollment } from './store';

/**
 * Device-anchored staff auth for the KDS surface, mirroring the manager flow in
 * `useAuth` (direct axios + the generated response types, so the flow never
 * depends on generated hook names). All calls go through the shared axios
 * instance, so the device endpoint routing (cloud vs. local hub) and the
 * `X-Device-Secret` header are applied automatically by the mutator. With the
 * cloud unreachable and the device pointed at the hub, the very same calls hit
 * the edge auth endpoint — no separate offline path.
 */

interface MePayload {
  user: AuthUser;
  permissions: string[];
  allBranches: boolean;
  accessibleBranches: BranchAccess[];
  defaultBranchId: string | null;
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/** Outcome of a PIN login attempt, so the UI can branch on lockout / rotation. */
export interface PinLoginOutcome {
  ok: boolean;
  /** The chosen PIN must be rotated (it was reset by a manager). */
  mustRotate: boolean;
  /** The server rejected this attempt because the PIN is locked / rate-limited. */
  lockedOut: boolean;
  /** Seconds to wait before retrying, if the server advertised one. */
  retryAfter?: number;
}

/**
 * True when a normalized error indicates a lockout / rate-limit rather than a
 * plain wrong PIN. Detection is deliberately conservative — it keys off the HTTP
 * status (429) and the machine `code`, NOT the human message, because the generic
 * 401 message for a wrong PIN already mentions "locked-out" and would misfire a
 * substring check. The client-side cooldown (after repeated misses) is the
 * backstop that guarantees no endpoint hammering regardless of server signalling.
 */
export function isLockoutError(error: NormalizedError | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  const code = (error.code ?? '').toUpperCase();
  return code.includes('LOCK') || code.includes('RATE') || code.includes('THROTTL');
}

function retryAfterFrom(error: NormalizedError): number | undefined {
  const details = error.details as { retryAfter?: unknown } | undefined;
  const value = details?.retryAfter;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Reactive list of branch staff for the login grid. Device-authenticated: the
 * mutator attaches the enrolled `X-Device-Secret`, so no bearer is needed yet.
 * Disabled until the device is enrolled.
 */
export function useStaffPicker(enabled: boolean) {
  return useQuery({
    queryKey: ['staffPicker'],
    enabled: enabled && Boolean(getDeviceSecret()),
    staleTime: 30_000,
    retry: 0,
    queryFn: () =>
      axiosInstance
        .get('/auth/staff-picker')
        .then((r) => unwrapData<StaffPickerEntryResponse[]>(r.data)),
  });
}

export function useStaffAuth() {
  const { setTokens, setMe, clear } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);

  /** PIN login: device secret + chosen user + 6-digit PIN -> a normal session. */
  const pinLogin = useCallback(
    async (userId: string, pin: string): Promise<PinLoginOutcome> => {
      const deviceSecret = getDeviceSecret();
      if (!deviceSecret) {
        const err: NormalizedError = {
          code: 'DEVICE_NOT_ENROLLED',
          message: 'This device is not enrolled.',
        };
        setError(err);
        return { ok: false, mustRotate: false, lockedOut: false };
      }

      setLoading(true);
      setError(null);
      try {
        const res = await axiosInstance
          .post('/auth/pin-login', { deviceSecret, userId, pin })
          .then((r) => unwrapData<PinLoginResponse>(r.data));

        setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });

        const me = await axiosInstance
          .get('/auth/me')
          .then((r) => unwrapData<MePayload>(r.data));
        setMe({
          user: me.user,
          permissions: me.permissions,
          allBranches: me.allBranches,
          accessibleBranches: me.accessibleBranches,
          defaultBranchId: me.defaultBranchId,
        });
        return { ok: true, mustRotate: res.mustRotate, lockedOut: false };
      } catch (e) {
        const err = e as NormalizedError;
        setError(err);
        clear();
        const lockedOut = isLockoutError(err);
        return {
          ok: false,
          mustRotate: false,
          lockedOut,
          retryAfter: lockedOut ? retryAfterFrom(err) : undefined,
        };
      } finally {
        setLoading(false);
      }
    },
    [setTokens, setMe, clear],
  );

  return { pinLogin, loading, error };
}

/** Outcome of a device enrollment attempt. */
export interface EnrollOutcome {
  ok: boolean;
}

/**
 * Enroll THIS device for the KDS surface. A manager signs in with email +
 * password ONLY long enough to call `POST /devices`; the returned secret is
 * persisted to IndexedDB and the temporary manager session is ended immediately
 * so the kiosk never keeps a manager logged in.
 */
export function useEnrollment() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const clear = useAuthStore((s) => s.clear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedError | null>(null);

  const enroll = useCallback(
    async (email: string, password: string, label: string): Promise<EnrollOutcome> => {
      setLoading(true);
      setError(null);
      try {
        // 1) Temporary manager session (break-glass: no device secret yet).
        const tokens = await axiosInstance
          .post('/auth/login', { email, password })
          .then((r) => unwrapData<{ accessToken: string; refreshToken: string }>(r.data));
        // Set tokens so the mutator attaches the bearer on the enroll call.
        setTokens({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });

        // 2) Enroll this device for KDS; the secret is returned exactly once.
        const enrolled = await axiosInstance
          .post('/devices', {
            surface: EnrollDeviceDtoSurface.KDS,
            label: label.trim() || 'Kitchen Display',
          })
          .then((r) => unwrapData<DeviceEnrolledResponse>(r.data));

        await persistEnrollment(enrolled.secret, enrolled.device.surface);

        return { ok: true };
      } catch (e) {
        setError(e as NormalizedError);
        return { ok: false };
      } finally {
        // 3) End the temporary manager session no matter what — enrollment never
        // leaves a manager signed in on a kitchen screen.
        clear();
        setLoading(false);
      }
    },
    [setTokens, clear],
  );

  return { enroll, loading, error };
}
