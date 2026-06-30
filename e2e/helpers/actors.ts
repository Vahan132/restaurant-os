/**
 * Three device-emulated actors, each its own browser context — the only model
 * that exercises the cross-app WebSocket handoffs the way production does:
 *   QR  = mobile (Pixel-class)   POS = tablet (iPad-class)   KDS = desktop.
 *
 * Playwright Test owns trace recording through playwright.config.ts. This helper
 * only records per-actor video and creates isolated browser contexts.
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
  const page = await context.newPage();
  return { name, context, page };
}

export async function closeActor(actor: Actor, _artifactsDir: string): Promise<void> {
  await actor.context.close(); // flushes the video file
}
