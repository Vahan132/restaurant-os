import { InvalidPhotoUrlError } from '../consumer.errors';

/**
 * A storage-agnostic photo URL. Validates that the value is a parseable URL with
 * the `https:` scheme. Pure — no framework imports.
 */
export class PhotoUrl {
  private constructor(readonly value: string) {}

  static create(raw: string): PhotoUrl {
    const trimmed = (raw ?? '').trim();
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new InvalidPhotoUrlError(raw);
    }
    if (parsed.protocol !== 'https:') {
      throw new InvalidPhotoUrlError(raw);
    }
    return new PhotoUrl(trimmed);
  }
}
