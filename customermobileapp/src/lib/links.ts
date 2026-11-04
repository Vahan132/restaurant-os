import { Linking } from 'react-native';

/** Open a `tel:` dialer for a phone number. No-ops on empty/invalid input. */
export async function openPhone(phone: string | null | undefined): Promise<void> {
  if (!phone) return;
  const url = `tel:${phone.replace(/\s+/g, '')}`;
  await safeOpen(url);
}

/** Open an external URL in the system browser, normalizing a missing scheme to https. */
export async function openWeb(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  await safeOpen(normalized);
}

async function safeOpen(url: string): Promise<void> {
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
  } catch {
    // Swallow — a dead link should never crash the screen.
  }
}
