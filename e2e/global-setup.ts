/**
 * Global setup: turn the deterministic E2E fixtures into ready-to-inject,
 * authenticated sessions for POS and KDS — without driving any PIN UI.
 *
 *   fixtures/seeded.json  (written by `pnpm db:seed:e2e` in ../api)
 *        │  pinLogin(deviceSecret, userId, pin)  ->  JWTs + branchId + user
 *        │  authMe(accessToken)                  ->  permissions/branches (KDS)
 *        ▼
 *   artifacts/session.json  (storageState objects + device secrets + URLs)
 *
 * The orchestrated spec reads session.json, injects storageState + the device
 * secret (IndexedDB), and runs the golden path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ENV } from './config/env';
import { pinLogin, authMe } from './helpers/api';
import { posStorageState, kdsStorageState } from './helpers/storage';

export default async function globalSetup(): Promise<void> {
  const fixturesPath = path.resolve(__dirname, 'fixtures/seeded.json');
  if (!fs.existsSync(fixturesPath)) {
    throw new Error(
      'Missing e2e/fixtures/seeded.json. Run in ../api:  pnpm db:seed && pnpm db:seed:e2e',
    );
  }
  const fx = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

  // POS: device-anchored PIN login -> JWTs (+ branch + user).
  const posLogin = await pinLogin({
    deviceSecret: fx.pos.deviceSecret,
    userId: fx.pos.userId,
    pin: fx.pos.pin,
  });
  const posState = posStorageState(ENV.origin, posLogin);

  // KDS: PIN login + /auth/me (the app populates permissions/branches from it).
  const kdsLogin = await pinLogin({
    deviceSecret: fx.kds.deviceSecret,
    userId: fx.kds.userId,
    pin: fx.kds.pin,
  });
  const me = await authMe(kdsLogin.accessToken);
  const kdsState = kdsStorageState(ENV.origin, kdsLogin, me, fx.kds.station);

  const session = {
    host: ENV.origin,
    customerUrl: ENV.customerUrl(fx.qrUrlPath),
    customerHome: ENV.customerHome,
    posHome: ENV.posHome,
    kdsHome: ENV.kdsHome,
    table: fx.table,
    dish: fx.dish,
    pos: { storageState: posState, deviceSecret: fx.pos.deviceSecret },
    kds: {
      storageState: kdsState,
      deviceSecret: fx.kds.deviceSecret,
      surface: fx.kds.deviceSurface,
      station: fx.kds.station,
    },
  };

  const outDir = path.resolve(__dirname, 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'session.json'), JSON.stringify(session, null, 2));
  // eslint-disable-next-line no-console
  console.log('[global-setup] POS + KDS sessions minted -> artifacts/session.json');
}
