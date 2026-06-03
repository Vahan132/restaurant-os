import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Persisted mute toggle for the new-ticket chime. Sound is opt-out (on by default). */
interface SoundState {
  muted: boolean;
  toggleMuted: () => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      muted: false,
      toggleMuted: () => set((s) => ({ muted: !s.muted })),
    }),
    { name: 'kds-sound' },
  ),
);

let audioCtx: AudioContext | null = null;

/**
 * Play a short, subtle two-tone chime via WebAudio (no asset file, no network).
 * No-op when muted or before any user gesture has unlocked audio.
 */
export function playNewTicketChime(): void {
  if (useSoundStore.getState().muted) return;
  if (typeof window === 'undefined') return;

  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.14);
    });
  } catch {
    // Audio not available (autoplay policy, etc.) — silently ignore.
  }
}
