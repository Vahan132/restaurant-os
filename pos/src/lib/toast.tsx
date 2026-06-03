'use client';

import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** ms before auto-dismiss; 0 = sticky. */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'> & { id?: string }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = t.id ?? Math.random().toString(36).slice(2);
    const toast: Toast = {
      id,
      title: t.title,
      description: t.description,
      variant: t.variant ?? 'info',
      duration: t.duration ?? 5000,
    };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    if (toast.duration > 0) {
      setTimeout(() => get().dismiss(id), toast.duration);
    }
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable outside React render (e.g. event handlers). */
export const toast = {
  show: (t: Omit<Toast, 'id'> & { id?: string }) => useToastStore.getState().push(t),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'info', duration: 5000 }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'success', duration: 5000 }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'warning', duration: 6000 }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: 'error', duration: 7000 }),
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: 'border-l-blue-500',
  success: 'border-l-green-600',
  warning: 'border-l-amber-500',
  error: 'border-l-red-600',
};

/** Renders the toast stack. Mounted once in the app shell. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto select-none rounded-lg border-l-4 bg-white p-4 text-left shadow-lg ring-1 ring-black/5 active:scale-[0.99] ${VARIANT_STYLES[t.variant]}`}
        >
          <p className="text-base font-semibold text-gray-900">{t.title}</p>
          {t.description ? <p className="mt-1 text-sm text-gray-600">{t.description}</p> : null}
        </button>
      ))}
    </div>
  );
}

/** Short notification beep via WebAudio (no asset needed). Best-effort; ignores errors. */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // ignore — sound is optional
  }
}
