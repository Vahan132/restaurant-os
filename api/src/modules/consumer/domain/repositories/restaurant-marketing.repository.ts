export const RESTAURANT_MARKETING_REPOSITORY = Symbol('RestaurantMarketingRepository');

export interface I18nText {
  hy?: string | null;
  ru?: string | null;
  en?: string | null;
}

/** Brand summary used by the completeness gate (logo lives on RestaurantSettings). */
export interface BrandSummary {
  restaurantId: string;
  name: string | null;
  logoUrl: string | null;
  about: I18nText;
  website: string | null;
  photoCount: number;
}

export interface PhotoRecord {
  id: string;
  position: number;
  url: string;
  /** MEDIA-1: object-storage key when uploaded (null for URL-paste). */
  objectKey: string | null;
  alt: I18nText;
  width: number | null;
  height: number | null;
}

export interface AddPhotoInput {
  url: string; // resolved public URL (from an upload) or a validated https paste
  /** MEDIA-1: object-storage key when uploaded; null for URL-paste. */
  objectKey?: string | null;
  alt: I18nText;
  width?: number | null;
  height?: number | null;
}

/**
 * Load/save the marketing profile, photos, and attribute selections for a
 * restaurant (brand-level). Writes are exercised by the seed now and by CX-ADMIN
 * later; reads here support the completeness gate.
 */
export interface RestaurantMarketingRepository {
  loadBrandSummary(restaurantId: string): Promise<BrandSummary | null>;

  /**
   * CX-ADMIN owner read: the restaurant's currently-selected attributeValueIds
   * (regardless of listed state). Empty when none are selected.
   */
  listSelectedAttributeValueIds(restaurantId: string): Promise<string[]>;

  /**
   * CX-ADMIN owner read: the platform kill switch for this brand. Null when the
   * restaurant does not exist (active, non-deleted).
   */
  loadConsumerListingSuppressed(restaurantId: string): Promise<boolean | null>;

  /** CX-ADMIN platform write: set the brand kill switch (overrides owner listing). */
  setConsumerListingSuppressed(restaurantId: string, value: boolean): Promise<void>;

  /** Set `about` (i18n) + `website`. */
  saveProfile(restaurantId: string, about: I18nText, website: string | null): Promise<void>;

  /** Replace the entire set of selected attributeValueIds (caller validates them). */
  setAttributes(restaurantId: string, attributeValueIds: string[]): Promise<void>;

  listPhotos(restaurantId: string): Promise<PhotoRecord[]>;
  /** Append a photo at the next position; returns its id. */
  addPhoto(restaurantId: string, input: AddPhotoInput): Promise<string>;
  /** Re-number positions to match the given id order (ids must be this brand's). */
  reorderPhotos(restaurantId: string, orderedPhotoIds: string[]): Promise<void>;
  removePhoto(restaurantId: string, photoId: string): Promise<void>;
}
