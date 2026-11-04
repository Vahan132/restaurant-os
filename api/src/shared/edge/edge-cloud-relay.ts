import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AppConfig } from '../infrastructure/config/env.schema';
import { APP_VERSION, EDGE_SCHEMA_VERSION_HEADER, SCHEMA_VERSION } from './version';

/**
 * EDGE-UPDATE-1 / HDM-EDGE-1 — small hub→cloud helper available to EVERY module
 * on the hub (EdgeModule is global; the edge-sync module is not importable from
 * feature modules). It does three things:
 *
 *  1. `request()`: an authenticated (node-token) call to the cloud API, mapping a
 *     cloud error back to the same HTTP status so the hub-served UI shows the
 *     cloud's message (e.g. "password required"), and a network failure to 503
 *     HUB_OFFLINE.
 *  2. `requestConfigSync()`: run the config pull NOW (the edge-sync module
 *     registers the runner on boot) so a change saved via the cloud shows up on
 *     the hub immediately instead of after the 2-minute poll.
 *  3. Hub data-volume files (`/data/...`, next to the pairing identity) used by
 *     the fiscal KEK and the updater handshake.
 *
 * Inert in CLOUD mode.
 */
@Injectable()
export class EdgeCloudRelay {
  private readonly logger = new Logger(EdgeCloudRelay.name);
  private readonly cloudUrl: string | undefined;
  private readonly token: string | undefined;
  private readonly isEdgeMode: boolean;
  private readonly dataDir: string;
  private configSyncRunner: (() => Promise<unknown>) | null = null;

  constructor(config: ConfigService<AppConfig, true>) {
    this.isEdgeMode = config.get('APP_MODE', { infer: true }) === 'EDGE';
    this.cloudUrl = config.get('CLOUD_URL', { infer: true });
    this.token = config.get('EDGE_NODE_TOKEN', { infer: true });
    const identityPath = config.get('EDGE_IDENTITY_PATH', { infer: true }) as string | undefined;
    this.dataDir = dirname(identityPath || '/data/edge-identity.env');
  }

  get isEdge(): boolean {
    return this.isEdgeMode;
  }

  /** True when the hub can talk to the cloud (paired with a URL + token). */
  get isConfigured(): boolean {
    return this.isEdgeMode && Boolean(this.cloudUrl && this.token);
  }

  /** Authenticated JSON call to the cloud (`path` is relative to CLOUD_URL). */
  async request<T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException({
        code: 'HUB_NOT_CONNECTED',
        message: 'This hub is not connected to the cloud.',
      });
    }
    const url = `${(this.cloudUrl as string).replace(/\/+$/, '')}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          accept: 'application/json',
          'content-type': 'application/json',
          [EDGE_SCHEMA_VERSION_HEADER]: SCHEMA_VERSION,
          'x-edge-app-version': APP_VERSION,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.warn(`Cloud call ${method} ${path} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException({
        code: 'HUB_OFFLINE',
        message:
          'The hub cannot reach the cloud right now. Connect the hub to the internet and try again.',
      });
    }
    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      const p = parsed as { error?: Record<string, unknown> } | null;
      const payload = (p && typeof p === 'object' && p.error) || p || {
        code: 'CLOUD_ERROR',
        message: `Cloud responded ${res.status}.`,
      };
      throw new HttpException(payload as Record<string, unknown>, res.status);
    }
    return parsed as T;
  }

  /** Called by the edge-sync module on boot. */
  registerConfigSync(runner: () => Promise<unknown>): void {
    this.configSyncRunner = runner;
  }

  /** Pull config from the cloud now (best-effort; never throws). */
  async requestConfigSync(): Promise<void> {
    if (!this.configSyncRunner) {
      return;
    }
    try {
      await this.configSyncRunner();
    } catch (err) {
      this.logger.warn(`Immediate config sync failed: ${(err as Error).message}`);
    }
  }

  /** Read a small file from the hub data volume (null when absent). */
  readDataFile(name: string): string | null {
    try {
      return readFileSync(join(this.dataDir, name), 'utf8').trim();
    } catch {
      return null;
    }
  }

  /** Write a small file to the hub data volume (0600). Returns false on failure. */
  writeDataFile(name: string, content: string): boolean {
    try {
      mkdirSync(this.dataDir, { recursive: true });
      writeFileSync(join(this.dataDir, name), content, { mode: 0o600 });
      return true;
    } catch (err) {
      this.logger.warn(`Could not write ${name}: ${(err as Error).message}`);
      return false;
    }
  }
}
