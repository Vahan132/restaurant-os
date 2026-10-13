/**
 * Profile-completeness gate (pure domain helper).
 *
 * `listedInConsumerApp = true` is allowed only when the brand+branch profile is
 * complete. Returns a structured list of missing fields (empty ⇒ complete) so
 * callers can surface exactly what is missing rather than a generic rejection.
 */
export interface CompletenessInput {
  /** Restaurant (brand). */
  restaurantName: string | null | undefined;
  logoUrl: string | null | undefined;
  about: { hy?: string | null; ru?: string | null; en?: string | null };
  photoCount: number;
  /** Branch (location). */
  branchAddress: string | null | undefined;
  /** Count of public-hours rows that are NOT closed. */
  openHoursCount: number;
}

/** Stable, client-surfaceable field keys for each possible gap. */
export type MissingField =
  | 'restaurant.name'
  | 'restaurant.logo'
  | 'restaurant.about'
  | 'restaurant.photos'
  | 'branch.address'
  | 'branch.openingHours';

export function evaluateCompleteness(input: CompletenessInput): MissingField[] {
  const missing: MissingField[] = [];

  if (!nonEmpty(input.restaurantName)) {
    missing.push('restaurant.name');
  }
  if (!nonEmpty(input.logoUrl)) {
    missing.push('restaurant.logo');
  }
  if (!nonEmpty(input.about.hy) && !nonEmpty(input.about.ru) && !nonEmpty(input.about.en)) {
    missing.push('restaurant.about');
  }
  if (input.photoCount < 1) {
    missing.push('restaurant.photos');
  }
  if (!nonEmpty(input.branchAddress)) {
    missing.push('branch.address');
  }
  if (input.openHoursCount < 1) {
    missing.push('branch.openingHours');
  }

  return missing;
}

/** Brand-only subset of the completeness gate (no branch context). */
export interface BrandCompletenessInput {
  restaurantName: string | null | undefined;
  logoUrl: string | null | undefined;
  about: { hy?: string | null; ru?: string | null; en?: string | null };
  photoCount: number;
}

/**
 * Brand-portion completeness, for the restaurant-level editor read (CX-ADMIN):
 * the owner edits brand fields on the restaurant screen, so the "what's missing"
 * there is the brand subset. The FULL gate (brand + branch) still runs per branch
 * via evaluateCompleteness when listing a branch.
 */
export function evaluateBrandCompleteness(input: BrandCompletenessInput): MissingField[] {
  return evaluateCompleteness({
    ...input,
    // Branch fields are satisfied here so only brand gaps surface; the per-branch
    // read/listing path evaluates the branch fields for real.
    branchAddress: 'n/a',
    openHoursCount: 1,
  });
}

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
