export const CONSUMER_PROFILE_READER = Symbol('ConsumerProfileReader');

/** Verified-profile fields a booking copies in (name/phone are never re-entered). */
export interface ConsumerProfileContact {
  name: string | null;
  phone: string | null;
}

/**
 * Reads the authenticated consumer's profile contact for bookings (CX-3). A narrow
 * read so the booking use-case need not depend on the whole identity context.
 */
export interface ConsumerProfileReader {
  /** Contact for the account, or null if the account no longer exists. */
  getContact(customerAccountId: string): Promise<ConsumerProfileContact | null>;
}
