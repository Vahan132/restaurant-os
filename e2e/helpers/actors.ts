/**
 * Three device-emulated actors, each its own browser context — the only model
 * that exercises the cross-app WebSocket handoffs the way production does:
 *   QR  = mobile (Pixel-class)   POS = tablet (iPad-class)   KDS = desktop.
 *
 * Per-actor trace + video are started here so each device can be watched /
 * replayed independently (artifacts/actors/<name>/...).
 */
import { devices } from '@playwright/test';
import type { Browser, BrowserContext, Page, BrowserContextOptions } from '@playwright/test';
import * as path from 'node:path';

export type ActorName = 'qr' | 'pos' | 'kds';

const DESCRIPTOR: Record<ActorName, (typeof devices)[string]> = {
  qr: devices['Pixel 5'],
  pos: devices['iPad Pro 11 landscape'],
  kds: devices['Desktop Chrome'],
};

export interface Actor {
  name: ActorName;
  context: BrowserContext;
  page: Page;
}

export async function openActor(
  browser: Browser,
  name: ActorName,
  opts: {
    artifactsDir: string;
    baseURL: string;
    storageState?: BrowserContextOptions['storageState'];
  },
): Promise<Actor> {
  const context = await browser.newContext({
    ...DESCRIPTOR[name],
    ignoreHTTPSErrors: true,
    baseURL: opts.baseURL, // one app per device-emulated context
    recordVideo: { dir: path.join(opts.artifactsDir, name, 'video') },
    // storageState accepts an object (localStorage origins) directly.
    storageState: opts.storageState,
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  return { name, context, page };
}

export async function closeActor(actor: Actor, artifactsDir: string): Promise<void> {
  try {
    await actor.context.tracing.stop({
      path: path.join(artifactsDir, actor.name, 'trace.zip'),
    });
  } finally {
    await actor.context.close(); // flushes the video file
  }
}
