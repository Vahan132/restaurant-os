import { buildSession } from './helpers/session';

export default async function globalSetup(): Promise<void> {
  await buildSession();
  // eslint-disable-next-line no-console
  console.log('[global-setup] POS + KDS sessions minted -> artifacts/session.json');
}
