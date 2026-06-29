'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/auth/store';
import { useDeviceStore } from '@/lib/device/store';
import { DeviceEnrollment } from '@/components/DeviceEnrollment';
import { StaffLogin } from '@/components/StaffLogin';

/**
 * Unauthenticated entry for the KDS. Two gates, device-first:
 *  1. Unenrolled device  -> enrollment (manager signs in once to bind it).
 *  2. Enrolled device     -> staff picker + PIN.
 * Either way, a successful sign-in lands on the board at `/`.
 */
export default function LoginPage() {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => Boolean(s.accessToken));
  const authHydrated = useAuthStore((s) => s.hydrated);
  const deviceHydrated = useDeviceStore((s) => s.hydrated);
  const enrolled = useDeviceStore((s) => Boolean(s.secret));

  // Already signed in (e.g. opened /login directly): go to the board.
  useEffect(() => {
    if (authHydrated && isAuthed) router.replace('/');
  }, [authHydrated, isAuthed, router]);

  // Wait for both persisted stores before choosing a gate, to avoid flashing
  // enrollment on an already-enrolled device.
  if (!deviceHydrated || !authHydrated) {
    return (
      <div className="flex h-screen items-center justify-center text-kiosk-lg text-kiosk-muted">
        …
      </div>
    );
  }

  const goToBoard = () => router.replace('/');

  // On enrollment the device store flips `enrolled` true and this re-renders into
  // the staff picker (the manager session was already ended during enrollment),
  // so the callback need not navigate.
  if (!enrolled) {
    return <DeviceEnrollment onEnrolled={() => undefined} />;
  }

  return <StaffLogin onSuccess={goToBoard} />;
}
