/**
 * Deployment coordinates. Defaults target the Tailscale + nginx path-routed dev
 * host from DEPLOY.md; override any of these via env for another deployment.
 *
 * All apps share ONE origin and are path-routed under /res/*, so every browser
 * context uses the same origin (storageState injection relies on this).
 */
const HOST = process.env.E2E_HOST ?? 'https://msi.tail8514ca.ts.net';

export const ENV = {
  /** Shared origin for all apps (storageState localStorage is keyed to this). */
  origin: HOST,
  /** REST base — used by global-setup to mint JWTs (POST /auth/pin-login). */
  apiBaseUrl: process.env.E2E_API_BASE_URL ?? `${HOST}/res/api`,
  /** Per-app roots — used as each device-context's baseURL (one app per actor). */
  posHome: `${HOST}/res/pos`,
  kdsHome: `${HOST}/res/kds`,
  customerHome: `${HOST}/res/m`,
  /** Build the QR customer entry URL from the seeded qrUrlPath (/res/m/<slug>?qr=). */
  customerUrl: (qrUrlPath: string): string => `${HOST}${qrUrlPath}`,
};
