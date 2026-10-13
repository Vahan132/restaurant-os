'use client';

import { StaffPickerLogin } from '@/components/auth/StaffPickerLogin';

/**
 * Sign-in for an enrolled terminal: the branch staff-picker + 6-digit PIN.
 *
 * Device enrollment (manager email/password → device secret) happens earlier, in
 * the DeviceEnrollmentGate, so by the time this route renders the terminal is
 * always enrolled and a device secret is available for the picker + PIN login.
 */
export default function LoginPage() {
  return <StaffPickerLogin />;
}
