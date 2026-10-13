import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  ObjectStoragePort,
  PresignUploadParams,
  PresignedUpload,
} from '../../application/ports/object-storage.port';

/**
 * Local dev object storage — no cloud creds required (mirrors the stub-adapter
 * pattern used for fiscalization/payment). Bytes are PUT to a dev endpoint on
 * this same API and written to a local directory; `publicUrl` points at a dev GET
 * endpoint that serves them back.
 *
 * NOTE: in dev, upload bytes DO transit the API (there is no external store to
 * PUT to). That's an accepted dev-only deviation from the direct-to-storage
 * invariant, which holds for the R2/production path. The presigned PUT URL is
 * HMAC-signed (key + expiry) so a stale/forged URL is rejected.
 */
export class DevObjectStorageAdapter implements ObjectStoragePort {
  private readonly base: string;
  private readonly ttlSeconds: number;
  private readonly signingSecret: string;

  static readonly ROUTE_PREFIX = 'media/dev/objects';

  constructor(config: ConfigService<AppConfig, true>) {
    this.base = (config.get('STORAGE_PUBLIC_BASE_URL', { infer: true }) as string).replace(
      /\/+$/,
      '',
    );
    this.ttlSeconds = config.get('MEDIA_PRESIGN_TTL_SECONDS', { infer: true });
    // Reuse an always-present secret; dev signing only needs to be non-guessable.
    this.signingSecret = config.get('JWT_ACCESS_SECRET', { infer: true }) as string;
  }

  /** HMAC over the upload intent — verified by the dev PUT handler. */
  static signature(key: string, expEpochMs: number, secret: string): string {
    return createHmac('sha256', secret).update(`PUT:${key}:${expEpochMs}`).digest('hex');
  }

  presignUpload(params: PresignUploadParams): Promise<PresignedUpload> {
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);
    const exp = expiresAt.getTime();
    const sig = DevObjectStorageAdapter.signature(params.key, exp, this.signingSecret);
    const url =
      `${this.base}/${DevObjectStorageAdapter.ROUTE_PREFIX}` +
      `?key=${encodeURIComponent(params.key)}&exp=${exp}&sig=${sig}` +
      `&contentType=${encodeURIComponent(params.contentType)}`;
    return Promise.resolve({ url, key: params.key, expiresAt });
  }

  publicUrl(key: string): string {
    return `${this.base}/${DevObjectStorageAdapter.ROUTE_PREFIX}?key=${encodeURIComponent(key)}`;
  }

  delete(): Promise<void> {
    // Dev files are disposable; no-op keeps the port contract simple.
    return Promise.resolve();
  }
}
