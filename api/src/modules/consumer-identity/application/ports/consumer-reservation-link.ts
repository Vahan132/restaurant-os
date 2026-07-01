/** DI token for the ConsumerReservationLink port. */
export const CONSUMER_RESERVATION_LINK = Symbol('ConsumerReservationLink');

export interface ConsumerReservationSummary {
  id: string;
  restaurantId: string;
  branchId: string;
  reservedAt: Date;
  status: string;
}

/**
 * Narrow gateway over the consumer's reservations, used ONLY by DeleteMyAccount.
 * Deliberately does NOT delete rows — delete-account severs the link + PII and
 * cancels, never removes reservation history.
 */
export interface ConsumerReservationLink {
  listByConsumer(consumerId: string): Promise<ConsumerReservationSummary[]>;
  /** Mark a single (past, still-active) reservation CANCELLED in place. */
  markCancelledInPlace(id: string, reason: string): Promise<void>;
  /**
   * Sever the consumer link + overwrite denormalized PII on ALL of the consumer's
   * reservations (shown as a "deleted user" placeholder in restaurant UIs).
   */
  anonymizeAll(consumerId: string, placeholderName: string): Promise<void>;
}
