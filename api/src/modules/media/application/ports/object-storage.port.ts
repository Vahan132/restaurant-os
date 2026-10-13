/** DI token for the ObjectStoragePort. */
export const OBJECT_STORAGE_PORT = Symbol('ObjectStoragePort');

/** Parameters for a single presigned PUT upload. */
export interface PresignUploadParams {
  /** Server-generated, tenant-scoped object key. Never chosen by the client. */
  key: string;
  /** Validated MIME type (allowlist). Bound into the signature so the client
   *  MUST send a matching `Content-Type` header on the PUT. */
  contentType: string;
  /** Advisory max byte size (see NOTE in the R2 adapter re: PUT-presign limits). */
  maxBytes: number;
}

/** A presigned upload the client PUTs bytes to directly (never via the API). */
export interface PresignedUpload {
  /** The presigned PUT URL. */
  url: string;
  /** The object key the caller records on the target entity at finalize. */
  key: string;
  /** When the presigned URL stops being valid. */
  expiresAt: Date;
}

/**
 * The single object-storage seam every image upload plugs into. Adapter-agnostic
 * — no R2 / S3 specifics leak to callers. Two adapters bind to the
 * OBJECT_STORAGE_PORT token: the R2 adapter (production, S3-compatible) and a
 * local dev adapter (no cloud creds). Mirrors the fiscalization/payment port
 * pattern; real vs dev swaps in the module with zero call-site change.
 */
export interface ObjectStoragePort {
  /** Presign a direct-to-storage PUT for a server-generated key. */
  presignUpload(params: PresignUploadParams): Promise<PresignedUpload>;
  /** Resolve a stored key to its public (CDN/bucket) URL. Pure/synchronous. */
  publicUrl(key: string): string;
  /** Best-effort delete (used by future cleanup; safe to call for a missing key). */
  delete(key: string): Promise<void>;
}
