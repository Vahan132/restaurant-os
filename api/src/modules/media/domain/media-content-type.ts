/**
 * The image content-type allowlist. Uploads are restricted to these MIME types;
 * the extension is derived server-side so the client never influences the key.
 * Kept pure (no framework imports).
 */
export const ALLOWED_IMAGE_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AllowedImageContentType = keyof typeof ALLOWED_IMAGE_CONTENT_TYPES;

/** Type-guard: is this a content-type we accept for image upload? */
export function isAllowedImageContentType(value: string): value is AllowedImageContentType {
  return Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_CONTENT_TYPES, value);
}

/** The canonical file extension for an allowed content-type (server-chosen). */
export function extensionForContentType(contentType: AllowedImageContentType): string {
  return ALLOWED_IMAGE_CONTENT_TYPES[contentType];
}

/** Best-effort reverse: content-type for a stored key's extension (dev serving). */
export function contentTypeForExtension(ext: string): string {
  const normalized = ext.toLowerCase();
  for (const [ct, e] of Object.entries(ALLOWED_IMAGE_CONTENT_TYPES)) {
    if (e === normalized) return ct;
  }
  return 'application/octet-stream';
}
