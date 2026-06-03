/**
 * Builds customer-app URLs for table QR codes from a configurable template.
 * The template uses {slug} (restaurant slug) and {qr} (table qrIdentifier),
 * e.g. "https://{slug}.restaurantos.app/?qr={qr}".
 */
export const CUSTOMER_URL_TEMPLATE =
  process.env.NEXT_PUBLIC_CUSTOMER_URL_TEMPLATE ?? 'http://localhost:3002/{slug}?qr={qr}';

export function buildCustomerUrl(slug: string, qr: string): string {
  return CUSTOMER_URL_TEMPLATE.replaceAll('{slug}', encodeURIComponent(slug)).replaceAll(
    '{qr}',
    encodeURIComponent(qr),
  );
}

const TOKEN_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** URL-safe random token for a table's qrIdentifier (crypto-backed). */
export function generateQrToken(length = 12): string {
  const out: string[] = [];
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) out.push(TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]!);
  } else {
    for (let i = 0; i < length; i++) {
      out.push(TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)]!);
    }
  }
  return out.join('');
}
