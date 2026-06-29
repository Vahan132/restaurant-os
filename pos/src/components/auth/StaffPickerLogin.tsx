'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  usePinAuthControllerStaffPicker,
  usePinAuthControllerLogin,
} from '@/api/generated/auth/auth';
import type { StaffPickerEntryResponse } from '@/api/generated/model';
import { useAuthStore } from '@/stores/auth';
import { useBranchStore } from '@/stores/branch';
import { useDeviceSecret } from '@/lib/device/useDeviceSecret';
import type { ApiError } from '@/api/mutator';
import { EndpointSettings } from '@/components/settings/EndpointSettings';

const PIN_LENGTH = 6;

/**
 * Staff-picker + PIN login (the enrolled-terminal sign-in).
 *
 * Step 1: a grid of the branch's staff (from the device-authenticated picker
 *   endpoint — names/roles only, never PIN data).
 * Step 2: the chosen staff enters their 6-digit PIN on an on-screen keypad.
 *
 * Submitting sends { deviceSecret, userId, pin } to /auth/pin-login. On success
 * we establish the NORMAL session (tokens + user) exactly like password login,
 * and bind the terminal to the branch the device is enrolled for.
 *
 * Works online and offline: every call routes through the axios mutator, so when
 * this terminal targets its Local hub (existing OFF-* LAN routing) the picker and
 * PIN login hit the edge instead of the cloud with no code change here.
 *
 * Lockout/rate-limit: when the backend reports a locked/rate-limited PIN we show
 * a clear locked state with a live countdown and disable the keypad, so the UI
 * never hammers the endpoint.
 */
export function StaffPickerLogin() {
  const t = useTranslations('staffLogin');
  const router = useRouter();
  const { secret } = useDeviceSecret();
  const deviceSecret = secret ?? '';

  const setSession = useAuthStore((s) => s.setSession);
  const setActiveBranch = useBranchStore((s) => s.setActiveBranch);

  const staffQuery = usePinAuthControllerStaffPicker(deviceSecret, {
    query: { enabled: deviceSecret.length > 0 },
  });
  const pinLogin = usePinAuthControllerLogin();

  const [selected, setSelected] = useState<StaffPickerEntryResponse | null>(null);

  const onAuthenticated = useCallback(
    (branchId: string) => {
      // Bind the terminal to the device's branch, then enter the app.
      if (branchId) setActiveBranch(branchId);
      router.replace('/');
    },
    [router, setActiveBranch],
  );

  // Step 2 — PIN entry for the chosen staff member.
  if (selected) {
    return (
      <PinEntry
        staff={selected}
        onBack={() => setSelected(null)}
        onSubmit={async (pin) => {
          const res = await pinLogin.mutateAsync({
            data: { deviceSecret, userId: selected.id, pin },
          });
          setSession(
            { accessToken: res.accessToken, refreshToken: res.refreshToken },
            res.user,
          );
          onAuthenticated(res.branchId);
        }}
      />
    );
  }

  // Step 1 — staff grid.
  return (
    <div className="flex min-h-dvh flex-col bg-gray-100 p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="mt-2 text-base text-gray-500">{t('subtitle')}</p>
          </div>
          <EndpointSettings variant="gear" />
        </div>

        <div className="mt-8">
          {staffQuery.isLoading ? (
            <p className="text-lg text-gray-500">{t('loading')}</p>
          ) : staffQuery.isError ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-lg text-red-600">{t('loadError')}</p>
              <button
                type="button"
                onClick={() => staffQuery.refetch()}
                className="min-h-[3rem] rounded-xl bg-gray-900 px-6 font-semibold text-white active:scale-95"
              >
                {t('retry')}
              </button>
            </div>
          ) : (staffQuery.data?.length ?? 0) === 0 ? (
            <p className="text-lg text-gray-500">{t('empty')}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {staffQuery.data?.map((staff) => (
                <li key={staff.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(staff)}
                    className="flex min-h-[7rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm transition active:scale-[0.98]"
                  >
                    <Avatar name={staff.fullName} />
                    <span className="line-clamp-2 text-lg font-semibold text-gray-900">
                      {staff.fullName}
                    </span>
                    {staff.roleName ? (
                      <span className="text-sm text-gray-500">{staff.roleName}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
  }, [name]);
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-lg font-bold text-white">
      {initials}
    </span>
  );
}

interface LockState {
  until: number; // epoch ms
}

function PinEntry({
  staff,
  onBack,
  onSubmit,
}: {
  staff: StaffPickerEntryResponse;
  onBack: () => void;
  onSubmit: (pin: string) => Promise<void>;
}) {
  const t = useTranslations('staffLogin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lock, setLock] = useState<LockState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submittingRef = useRef(false);

  const locked = lock !== null && lock.until > now;
  const remainingSec = locked ? Math.ceil((lock!.until - now) / 1000) : 0;

  // Tick once a second only while locked, to drive the countdown.
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  // Clear an expired lock so the keypad re-enables.
  useEffect(() => {
    if (lock && lock.until <= now) setLock(null);
  }, [lock, now]);

  const submit = useCallback(
    async (value: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        await onSubmit(value);
        // success → navigation handled by caller
      } catch (err) {
        const apiErr = err as ApiError | undefined;
        const lockUntil = getLockUntil(apiErr);
        if (lockUntil) {
          setLock({ until: lockUntil });
          setNow(Date.now());
          setError(null);
        } else {
          setError(apiErr?.message || t('invalidPin'));
        }
        setPin('');
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [onSubmit, t],
  );

  const press = useCallback(
    (digit: string) => {
      if (locked || submitting) return;
      setError(null);
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + digit;
        if (next.length === PIN_LENGTH) void submit(next);
        return next;
      });
    },
    [locked, submitting, submit],
  );

  const backspace = useCallback(() => {
    if (locked || submitting) return;
    setPin((prev) => prev.slice(0, -1));
  }, [locked, submitting]);

  // Hardware-keyboard support (kiosks may have one attached).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Escape') onBack();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, backspace, onBack]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 text-base font-semibold text-gray-500 hover:underline"
        >
          ← {t('back')}
        </button>

        <div className="flex flex-col items-center text-center">
          <Avatar name={staff.fullName} />
          <h1 className="mt-3 text-2xl font-bold text-gray-900">{staff.fullName}</h1>
          <p className="mt-1 text-base text-gray-500">{t('enterPin')}</p>
        </div>

        {/* PIN dots */}
        <div className="mt-6 flex justify-center gap-3" aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border-2 ${
                i < pin.length ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-transparent'
              }`}
            />
          ))}
        </div>

        {locked ? (
          <p className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-center text-base font-medium text-amber-800">
            {t('locked', { seconds: remainingSec })}
          </p>
        ) : error ? (
          <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700">
            {error}
          </p>
        ) : (
          <p className="mt-5 h-[3.25rem]" />
        )}

        {/* Keypad */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <KeypadButton key={d} disabled={locked || submitting} onClick={() => press(d)}>
              {d}
            </KeypadButton>
          ))}
          <span />
          <KeypadButton disabled={locked || submitting} onClick={() => press('0')}>
            0
          </KeypadButton>
          <KeypadButton
            disabled={locked || submitting || pin.length === 0}
            onClick={backspace}
            aria-label={t('backspace')}
          >
            ⌫
          </KeypadButton>
        </div>

        {submitting ? (
          <p className="mt-5 text-center text-base text-gray-500">{t('verifying')}</p>
        ) : null}
      </div>
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
  ...rest
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-16 select-none rounded-xl bg-gray-100 text-2xl font-bold text-gray-900 transition active:scale-95 disabled:opacity-40"
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * Derive a lock-until timestamp (epoch ms) from a PIN-login error, or null if
 * this isn't a lockout/rate-limit. Reads the backend's structured details when
 * present (retryAfter / retryAfterSeconds), else falls back to a safe default so
 * the keypad still backs off instead of hammering the endpoint.
 */
function getLockUntil(err: ApiError | undefined): number | null {
  if (!err) return null;
  const code = (err.code || '').toUpperCase();
  const isLock =
    err.status === 429 ||
    err.status === 423 ||
    code.includes('LOCK') ||
    code.includes('RATE') ||
    code.includes('TOO_MANY');
  if (!isLock) return null;

  const seconds = readRetrySeconds(err.details) ?? 30;
  return Date.now() + seconds * 1000;
}

function readRetrySeconds(details: unknown): number | null {
  if (!details || typeof details !== 'object') return null;
  const d = details as Record<string, unknown>;
  for (const key of ['retryAfterSeconds', 'retryAfter', 'lockedForSeconds', 'remainingSeconds']) {
    const v = d[key];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.ceil(v);
  }
  return null;
}
