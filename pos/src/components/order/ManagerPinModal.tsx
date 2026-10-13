'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/** PIN length the backend enforces (DiscountAuthorizationDto.pin: 6 digits). */
const PIN_LENGTH = 6;

/**
 * Outcome of a step-up submit. The modal never learns WHICH factor failed — the
 * backend returns a single generic rejection (so we don't leak whether the device
 * secret or the PIN was wrong). `lockout` is the device-level rate-limit state.
 */
export type StepUpOutcome =
  | { kind: 'ok' }
  | { kind: 'failed' }
  | { kind: 'lockout'; retryAfterSeconds?: number };

/** Performs the authorized request with the entered PIN and reports the outcome. */
export type StepUpSubmit = (pin: string) => Promise<StepUpOutcome>;

/**
 * Manager step-up authorization, counter-optimized.
 *
 * `requestStepUp(submit)` opens the manager-PIN modal. The requesting user is NOT
 * logged out — this is an inline authorization. The modal collects a manager's
 * 6-digit PIN and calls `submit(pin)`, which sends the enrolled device secret +
 * PIN to the step-up endpoint. The promise resolves `true` once a discount has
 * been authorized and applied, or `false` if the cashier cancelled.
 *
 * Mirrors the `useManagerApproval` shape (returns a modal element to render).
 */
export function useDiscountStepUp() {
  const [submit, setSubmit] = useState<StepUpSubmit | null>(null);
  const resolverRef = useRef<((applied: boolean) => void) | null>(null);

  const requestStepUp = useCallback((onSubmit: StepUpSubmit) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      // Store the function itself (not a state updater) behind a thunk.
      setSubmit(() => onSubmit);
    });
  }, []);

  const finish = useCallback((applied: boolean) => {
    resolverRef.current?.(applied);
    resolverRef.current = null;
    setSubmit(null);
  }, []);

  const StepUpModal = submit ? (
    <ManagerPinModal
      onSubmit={submit}
      onAuthorized={() => finish(true)}
      onCancel={() => finish(false)}
    />
  ) : null;

  return { requestStepUp, StepUpModal };
}

type Status = 'idle' | 'submitting' | 'failed' | 'lockout';

function ManagerPinModal({
  onSubmit,
  onAuthorized,
  onCancel,
}: {
  onSubmit: StepUpSubmit;
  onAuthorized: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('stepup');
  const tc = useTranslations('common');

  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [cooldown, setCooldown] = useState(0);

  const locked = status === 'lockout';
  const busy = status === 'submitting';

  // Lockout countdown — when it elapses, re-enable entry (no auto-retry).
  useEffect(() => {
    if (!locked || cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [locked, cooldown]);

  useEffect(() => {
    if (locked && cooldown === 0) setStatus('idle');
  }, [locked, cooldown]);

  const doSubmit = useCallback(
    async (value: string) => {
      setStatus('submitting');
      const outcome = await onSubmit(value);
      if (outcome.kind === 'ok') {
        onAuthorized();
        return;
      }
      if (outcome.kind === 'lockout') {
        setPin('');
        setCooldown(outcome.retryAfterSeconds ?? 0);
        setStatus('lockout');
        return;
      }
      // Generic failure — clear and let them retry, no dead-end.
      setPin('');
      setStatus('failed');
    },
    [onSubmit, onAuthorized],
  );

  // Quick at the counter: auto-submit the moment the 6th digit lands.
  useEffect(() => {
    if (pin.length === PIN_LENGTH && status !== 'submitting' && !locked) {
      void doSubmit(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const press = useCallback(
    (digit: string) => {
      if (busy || locked) return;
      setStatus('idle');
      setPin((p) => (p.length >= PIN_LENGTH ? p : p + digit));
    },
    [busy, locked],
  );

  const backspace = useCallback(() => {
    if (busy || locked) return;
    setPin((p) => p.slice(0, -1));
  }, [busy, locked]);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="mt-1 text-base text-gray-500">{t('subtitle')}</p>

        {/* PIN dots */}
        <div className="mt-5 flex justify-center gap-3" aria-hidden>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full ${
                i < pin.length ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Status line — generic failure / lockout, never which factor failed */}
        <div className="mt-3 min-h-[2.75rem]">
          {status === 'failed' ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-base font-medium text-red-700">
              {t('failed')}
            </p>
          ) : null}
          {locked ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-center text-base font-medium text-amber-800">
              {cooldown > 0 ? t('lockoutCountdown', { seconds: cooldown }) : t('lockout')}
            </p>
          ) : null}
          {busy ? (
            <p className="text-center text-base font-medium text-gray-500">{t('authorizing')}</p>
          ) : null}
        </div>

        {/* Numeric pad */}
        <div className="mt-2 grid grid-cols-3 gap-3">
          {keys.map((k) => (
            <PadButton key={k} label={k} disabled={busy || locked} onClick={() => press(k)} />
          ))}
          <PadButton label={tc('cancel')} variant="muted" onClick={onCancel} />
          <PadButton label="0" disabled={busy || locked} onClick={() => press('0')} />
          <PadButton
            label="⌫"
            variant="muted"
            disabled={busy || locked || pin.length === 0}
            onClick={backspace}
          />
        </div>
      </div>
    </div>
  );
}

function PadButton({
  label,
  onClick,
  disabled,
  variant = 'digit',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'digit' | 'muted';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-tap h-16 select-none rounded-xl text-xl font-bold active:scale-95 disabled:opacity-40 ${
        variant === 'digit'
          ? 'bg-gray-100 text-gray-900'
          : 'bg-white text-gray-600 ring-1 ring-gray-300 text-base font-semibold'
      }`}
    >
      {label}
    </button>
  );
}
