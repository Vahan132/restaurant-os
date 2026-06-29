'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StaffPickerEntryResponse } from '@/api/generated/model/staffPickerEntryResponse';
import { useStaffAuth, useStaffPicker } from '@/lib/device/useStaffAuth';
import { useToast } from '@/components/Toast';
import { EndpointConfig } from './EndpointConfig';
import { LanguageSwitcher } from './LanguageSwitcher';

const PIN_LENGTH = 6;
/** Client-side guard: after this many wrong PINs, cool down without re-hitting the server. */
const MAX_LOCAL_ATTEMPTS = 5;
const LOCAL_COOLDOWN_SECONDS = 30;

/**
 * Device-authenticated staff sign-in for an ENROLLED KDS device: a branch staff
 * grid, then a 6-digit PIN. The device secret + chosen user + PIN are exchanged
 * for a normal session (identical downstream to a manager login). With the cloud
 * down and the device pointed at its hub, the same calls authenticate against
 * the edge.
 *
 * Lockout/rate-limit is shown clearly and the pad is disabled while locked — both
 * when the server reports a lockout (401 locked / 429) and after repeated local
 * misses — so a locked PIN never hammers the endpoint.
 */
export function StaffLogin({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations('staff');
  const { push } = useToast();
  const staff = useStaffPicker(true);
  const { pinLogin, loading } = useStaffAuth();

  const [selected, setSelected] = useState<StaffPickerEntryResponse | null>(null);
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);
  const submittingRef = useRef(false);

  const locked = lockSeconds > 0;

  // Lockout countdown tick. Hook is unconditional; it simply no-ops when unlocked.
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const id = setInterval(() => {
      setLockSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [lockSeconds]);

  // Clear the residual lockout/error state when the unlock countdown finishes.
  useEffect(() => {
    if (lockSeconds === 0) {
      setAttempts(0);
      setWrong(false);
    }
  }, [lockSeconds]);

  const resetEntry = useCallback(() => {
    setPin('');
    setWrong(false);
  }, []);

  const submit = useCallback(
    async (userId: string, code: string) => {
      if (submittingRef.current || locked) return;
      submittingRef.current = true;
      const outcome = await pinLogin(userId, code);
      submittingRef.current = false;

      if (outcome.ok) {
        if (outcome.mustRotate) push(t('mustRotate'), 'info');
        onSuccess();
        return;
      }

      setPin('');
      if (outcome.lockedOut) {
        // Server-signaled lockout: honor its retry window if provided.
        setLockSeconds(outcome.retryAfter ?? LOCAL_COOLDOWN_SECONDS);
        return;
      }

      setWrong(true);
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      if (nextAttempts >= MAX_LOCAL_ATTEMPTS) {
        // Too many local misses: cool down instead of hammering the endpoint.
        setLockSeconds(LOCAL_COOLDOWN_SECONDS);
      }
    },
    [attempts, locked, onSuccess, pinLogin, push, t],
  );

  // Auto-submit once the 6th digit is entered.
  useEffect(() => {
    if (selected && pin.length === PIN_LENGTH && !locked && !loading) {
      void submit(selected.id, pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selected, locked]);

  function pressDigit(d: string) {
    if (locked || loading) return;
    setWrong(false);
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
  }

  function backspace() {
    if (locked || loading) return;
    setWrong(false);
    setPin((p) => p.slice(0, -1));
  }

  function chooseStaff(member: StaffPickerEntryResponse) {
    setSelected(member);
    resetEntry();
  }

  function back() {
    setSelected(null);
    resetEntry();
  }

  // --- staff grid -----------------------------------------------------------
  if (!selected) {
    return (
      <Screen>
        <div className="absolute right-6 top-6">
          <LanguageSwitcher />
        </div>

        <div className="text-center">
          <h1 className="text-kiosk-xl font-bold">{t('title')}</h1>
          <p className="mt-2 text-kiosk text-kiosk-muted">{t('subtitle')}</p>
        </div>

        {staff.isLoading ? (
          <p className="text-kiosk-lg text-kiosk-muted">{t('loading')}</p>
        ) : staff.isError ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-kiosk-lg text-status-delayed">{t('loadError')}</p>
            <button
              type="button"
              onClick={() => staff.refetch()}
              className="rounded-lg border border-kiosk-border px-6 py-3 text-kiosk text-kiosk-muted hover:bg-kiosk-border"
            >
              {t('retry')}
            </button>
          </div>
        ) : (staff.data?.length ?? 0) === 0 ? (
          <p className="text-kiosk-lg text-kiosk-muted">{t('empty')}</p>
        ) : (
          <div className="flex max-w-5xl flex-wrap justify-center gap-6">
            {staff.data?.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => chooseStaff(member)}
                className="flex h-32 w-64 flex-col items-center justify-center gap-2 rounded-2xl border-4 border-kiosk-border bg-kiosk-panel px-4 text-kiosk-text transition-colors hover:border-status-sent"
              >
                <span className="text-kiosk-lg font-bold">{member.fullName}</span>
                {member.roleName && (
                  <span className="text-base text-kiosk-muted">{member.roleName}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-kiosk-border pt-6">
          <EndpointConfig />
        </div>
      </Screen>
    );
  }

  // --- PIN pad --------------------------------------------------------------
  return (
    <Screen>
      <div className="absolute right-6 top-6">
        <LanguageSwitcher />
      </div>

      <button
        type="button"
        onClick={back}
        className="absolute left-6 top-6 rounded-lg border border-kiosk-border px-5 py-3 text-kiosk text-kiosk-muted hover:bg-kiosk-border"
      >
        {t('back')}
      </button>

      <div className="text-center">
        <h1 className="text-kiosk-xl font-bold">{selected.fullName}</h1>
        <p className="mt-2 text-kiosk text-kiosk-muted">{t('enterPin')}</p>
      </div>

      <PinDots length={PIN_LENGTH} filled={pin.length} error={wrong} />

      {locked ? (
        <p className="text-kiosk-lg font-semibold text-status-delayed" role="alert">
          {t('locked', { seconds: lockSeconds })}
        </p>
      ) : wrong ? (
        <p className="text-kiosk font-semibold text-status-delayed" role="alert">
          {t('wrongPin')}
        </p>
      ) : (
        <p className="text-kiosk text-kiosk-muted">{loading ? t('checking') : ' '}</p>
      )}

      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <PadKey key={d} disabled={locked || loading} onClick={() => pressDigit(d)}>
            {d}
          </PadKey>
        ))}
        <PadKey disabled={locked || loading || pin.length === 0} onClick={backspace}>
          ⌫
        </PadKey>
        <PadKey disabled={locked || loading} onClick={() => pressDigit('0')}>
          0
        </PadKey>
        <span className="h-24 w-24" />
      </div>
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-10 px-8 py-12">
      {children}
    </div>
  );
}

function PinDots({
  length,
  filled,
  error,
}: {
  length: number;
  filled: number;
  error: boolean;
}) {
  return (
    <div className="flex gap-5">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className={`h-6 w-6 rounded-full border-4 transition-colors ${
            error
              ? 'border-status-delayed'
              : i < filled
                ? 'border-status-sent bg-status-sent'
                : 'border-kiosk-border'
          }`}
        />
      ))}
    </div>
  );
}

function PadKey({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-24 w-24 rounded-2xl border-4 border-kiosk-border bg-kiosk-panel text-kiosk-xl font-bold text-kiosk-text transition-colors hover:border-status-sent disabled:opacity-40 disabled:hover:border-kiosk-border"
    >
      {children}
    </button>
  );
}
