import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../../../shared/infrastructure/config/env.schema';
import {
  ObjectStoragePort,
  PresignUploadParams,
  PresignedUpload,
} from '../../application/ports/object-storage.port';

/**
 * Cloudflare R2 adapter (S3-compatible). Endpoint is the account R2 endpoint;
 * R2 requires path-style addressing. Config comes from env; the module only
 * constructs this adapter when STORAGE_DRIVER=r2, and env.schema fails fast in
 * production if the R2_* vars are missing — so a missing-config app never boots.
 *
 * NOTE: size cap. A presigned PUT (getSignedUrl on PutObjectCommand) cannot
 * strictly enforce a byte ceiling — that needs a POST policy with
 * content-length-range. `maxBytes` is therefore advisory on this path; the
 * content-TYPE is enforced because it is signed into the request (the client's
 * PUT must send a matching Content-Type). Hard size enforcement is a follow-up.
 */
export class R2ObjectStorageAdapter implements ObjectStoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService<AppConfig, true>) {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true }) as string;
    const accessKeyId = config.get('R2_ACCESS_KEY_ID', { infer: true }) as string;
    const secretAccessKey = config.get('R2_SECRET_ACCESS_KEY', { infer: true }) as string;
    this.bucket = config.get('R2_BUCKET', { infer: true }) as string;
    this.publicBase = (config.get('STORAGE_PUBLIC_BASE_URL', { infer: true }) as string).replace(
      /\/+$/,
      '',
    );
    this.ttlSeconds = config.get('MEDIA_PRESIGN_TTL_SECONDS', { infer: true });

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async presignUpload(params: PresignUploadParams): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: this.ttlSeconds });
    return {
      url,
      key: params.key,
      expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
    };
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
