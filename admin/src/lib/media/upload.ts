/**
 * MEDIA-1-FE client-side upload helpers. Constants mirror the backend so the
 * user gets an instant, clear rejection instead of a failed presign.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** 5 MiB — mirrors the backend MEDIA_MAX_UPLOAD_BYTES default. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type UploadValidationError = 'type' | 'size';

/** Validate type + size before we even ask the backend for a presign. */
export function validateImageFile(file: File): UploadValidationError | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > MAX_UPLOAD_BYTES) return 'size';
  return null;
}

/**
 * PUT the file bytes DIRECTLY to the presigned URL.
 *
 * CRITICAL (the classic presigned-upload footgun): this uses a bare `fetch`, NOT
 * the app's axios `customInstance`. The app instance would attach `Authorization`
 * and `X-Branch-Id`; R2's presigned signature covers a specific header set, so any
 * extra header makes R2 reject the upload. Only `Content-Type` is sent — it is
 * part of the request the backend signed. Bytes never go through our API.
 */
export async function putToPresignedUrl(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Direct upload failed with status ${res.status}`);
  }
}
