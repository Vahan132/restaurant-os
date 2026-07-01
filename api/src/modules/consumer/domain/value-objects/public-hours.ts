import { InvalidPublicHoursError } from '../consumer.errors';

/** A single weekday's public opening hours. Pure — no framework imports. */
export interface PublicHoursRowInput {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt?: string | null;
  closesAt?: string | null;
}

export class PublicHoursRow {
  private constructor(
    readonly dayOfWeek: number,
    readonly isClosed: boolean,
    readonly opensAt: string | null,
    readonly closesAt: string | null,
  ) {}

  /**
   * Validates one weekday row:
   *   - dayOfWeek is an integer in [0,6] (0=Mon … 6=Sun);
   *   - if isClosed=false, BOTH opensAt and closesAt are required, well-formed
   *     "HH:mm" (00:00–23:59);
   *   - if isClosed=true, times are ignored (stored as null).
   * NOTE: closesAt < opensAt is allowed — it means the slot crosses midnight
   * (e.g. 20:00–03:00). Only equality is rejected (a zero-length window).
   */
  static create(input: PublicHoursRowInput): PublicHoursRow {
    const { dayOfWeek, isClosed } = input;
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new InvalidPublicHoursError(`dayOfWeek must be an integer 0–6 (got ${dayOfWeek}).`);
    }
    if (isClosed) {
      return new PublicHoursRow(dayOfWeek, true, null, null);
    }
    const opensAt = (input.opensAt ?? '').trim();
    const closesAt = (input.closesAt ?? '').trim();
    if (!opensAt || !closesAt) {
      throw new InvalidPublicHoursError(
        `Open day ${dayOfWeek} requires both opensAt and closesAt.`,
      );
    }
    if (!isHhMm(opensAt) || !isHhMm(closesAt)) {
      throw new InvalidPublicHoursError(
        `opensAt/closesAt must be "HH:mm" (got "${opensAt}"/"${closesAt}").`,
      );
    }
    if (opensAt === closesAt) {
      throw new InvalidPublicHoursError(`opensAt and closesAt must differ (day ${dayOfWeek}).`);
    }
    return new PublicHoursRow(dayOfWeek, false, opensAt, closesAt);
  }

  /** True when the slot wraps past midnight (closes the next calendar day). */
  get crossesMidnight(): boolean {
    return !this.isClosed && this.opensAt !== null && this.closesAt !== null
      ? this.closesAt < this.opensAt
      : false;
  }
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isHhMm(value: string): boolean {
  return HH_MM.test(value);
}
