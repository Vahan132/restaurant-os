import { I18nText, PhotoRecord } from './restaurant-marketing.repository';

export const BRANCH_PUBLIC_REPOSITORY = Symbol('BranchPublicRepository');

/** One weekday's stored public hours. dayOfWeek 0=Mon … 6=Sun. */
export interface PublicHoursRecord {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
}

/** Branch public state used by the completeness gate + toggles. */
export interface BranchPublicState {
  branchId: string;
  restaurantId: string;
  address: string | null;
  city: string | null;
  publicPhone: string | null;
  menuPublic: boolean;
  reservationsPublic: boolean;
  listedInConsumerApp: boolean;
  /** Platform kill switch on the parent restaurant (CX-ADMIN owner read). */
  consumerListingSuppressed: boolean;
  /** Count of public-hours rows that are NOT closed. */
  openHoursCount: number;
}

export interface SetBranchContactInput {
  publicPhone: string | null;
  address: string | null;
  city: string | null;
}

/** A short, localized attribute label shown on a discovery card. */
export interface AttributeSummaryItem {
  slug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
}

/** A discovery list card (the listing unit is the Branch). */
export interface ConsumerBranchCard {
  branchId: string;
  restaurantId: string;
  name: string; // brand name (Restaurant.name)
  logoUrl: string | null; // RestaurantSettings.logoUrl
  heroPhotoUrl: string | null; // first brand photo by position
  address: string | null;
  city: string | null;
  menuPublic: boolean;
  reservationsPublic: boolean;
  attributes: AttributeSummaryItem[]; // short summary
}

/** Attributes grouped by category for the detail "Features" list. */
export interface FeatureGroup {
  categorySlug: string;
  labelHy: string;
  labelRu: string;
  labelEn: string;
  values: AttributeSummaryItem[];
}

export interface ConsumerBranchDetail {
  branchId: string;
  restaurantId: string;
  restaurantSlug: string;
  branchSlug: string;
  timezone: string; // Restaurant.timezone — to resolve "today" in branch-local time
  name: string;
  logoUrl: string | null;
  address: string | null;
  city: string | null;
  publicPhone: string | null;
  website: string | null;
  about: I18nText;
  weeklyHours: PublicHoursRecord[];
  gallery: PhotoRecord[];
  features: FeatureGroup[];
  menuPublic: boolean;
  reservationsPublic: boolean;
}

export interface ListConsumerBranchesFilter {
  q?: string;
  attributeValueIds?: string[];
  skip: number;
  take: number;
}

/**
 * Load/save branch public fields + public hours, and serve the anonymous read
 * queries. The list/detail queries apply the EFFECTIVE-LISTING rule
 * (`branch.listedInConsumerApp && !restaurant.consumerListingSuppressed`) and do
 * search + attribute filtering + pagination at the QUERY level (never in memory).
 */
export interface BranchPublicRepository {
  // ── writes (seed now, CX-ADMIN later) ──────────────────────────────────────
  loadState(branchId: string): Promise<BranchPublicState | null>;
  /** CX-ADMIN owner read: the branch's stored weekly public hours (all 7 rows or fewer). */
  listPublicHours(branchId: string): Promise<PublicHoursRecord[]>;
  setPublicContact(branchId: string, input: SetBranchContactInput): Promise<void>;
  /** Upsert the 7-day schedule (replace existing rows for this branch). */
  setPublicHours(branchId: string, rows: PublicHoursRecord[]): Promise<void>;
  setMenuPublic(branchId: string, value: boolean): Promise<void>;
  setReservationsPublic(branchId: string, value: boolean): Promise<void>;
  setListed(branchId: string, value: boolean): Promise<void>;

  // ── anonymous reads ────────────────────────────────────────────────────────
  listConsumerBranches(
    filter: ListConsumerBranchesFilter,
  ): Promise<{ items: ConsumerBranchCard[]; total: number }>;
  /** Effectively-listed branch detail, or null when not effectively listed. */
  getConsumerBranchDetail(branchId: string): Promise<ConsumerBranchDetail | null>;
  /** Effective-listing + reservationsPublic check for the availability endpoint. */
  loadAvailabilityContext(branchId: string): Promise<{
    restaurantId: string;
    branchId: string;
    reservationsPublic: boolean;
  } | null>;
  /**
   * CX-3 booking context for an effectively-listed branch: ids, reservationsPublic
   * flag, the restaurant timezone (to resolve opening hours to absolute instants),
   * and the per-weekday public hours. Null when the branch is not effectively
   * listed. Distinct from loadAvailabilityContext (which is PII-free busy windows).
   */
  loadBookingContext(branchId: string): Promise<{
    restaurantId: string;
    branchId: string;
    reservationsPublic: boolean;
    timezone: string;
    hours: PublicHoursRecord[];
  } | null>;
  /**
   * CX-3 saved list: discovery-style cards for the given branch ids that are STILL
   * effectively listed. Branch ids that are no longer listed are simply omitted —
   * the caller flags them as unlisted.
   */
  getCardsByBranchIds(branchIds: string[]): Promise<ConsumerBranchCard[]>;
}
