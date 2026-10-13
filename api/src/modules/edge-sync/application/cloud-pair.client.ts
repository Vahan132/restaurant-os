import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../shared/infrastructure/config/env.schema';

/** The identity the cloud returns from POST /edge/pair (delivered once). */
export interface CloudPairResult {
  nodeId: string;
  nodeToken: string;
  /** Per-hub fiscal KEK, 64 hex chars. Absent when the platform has no master KEK. */
  fiscalKek?: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
}

/**
 * A failed pairing attempt. `reachable=false` means the cloud could not be reached
 * (network/DNS/TLS); otherwise `apiCode` carries the cloud error code (e.g.
 * INVALID_PAIRING_CODE, PAIRING_KEK_UNAVAILABLE) so the setup page can show a
 * clear, actionable message.
 */
export class CloudPairError extends Error {
  constructor(
    message: string,
    readonly reachable: boolean,
    readonly apiCode: string | null,
    readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = 'CloudPairError';
  }
}

/**
 * EDGE-SETUP-3A hub-side client for the cloud EDGE-PAIR-2 exchange. Uses the
 * baked-in CLOUD_URL (image constant) — no token needed (pairing is what mints it).
 */
@Injectable()
export class CloudPairClient {
  private readonly cloudUrl: string | undefined;

  constructor(config: ConfigService<AppConfig, true>) {
    this.cloudUrl = config.get('CLOUD_URL', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.cloudUrl);
  }

  async pair(code: string, overrideUrl?: string): Promise<CloudPairResult> {
    const effectiveUrl = (overrideUrl && overrideUrl.trim()) || this.cloudUrl;
    if (!effectiveUrl) {
      throw new CloudPairError(
        'The cloud URL is not configured on this hub (CLOUD_URL).',
        false,
        'CLOUD_URL_NOT_CONFIGURED',
        null,
      );
    }
    const base = effectiveUrl.replace(/\/+$/, '');

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
      res = await fetch(`${base}/edge/pair`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ code }),
      });
    } catch (err) {
      // Network-level failure — the hub stays in setup mode; the page retries.
      throw new CloudPairError(
        `Could not reach the cloud to pair: ${(err as Error).message}`,
        false,
        null,
        null,
      );
    }

    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let apiCode: string | null = null;
      try {
        const parsed = JSON.parse(raw) as { error?: { code?: string }; code?: string };
        apiCode = parsed.error?.code ?? parsed.code ?? null;
      } catch {
        // non-JSON body
      }
      throw new CloudPairError(
        `Pairing was rejected by the cloud (${res.status}).`,
        true,
        apiCode,
        res.status,
      );
    }

    // The cloud returns the pair result as-is (single resource, not enveloped).
    return (await res.json()) as CloudPairResult;
  }
}
