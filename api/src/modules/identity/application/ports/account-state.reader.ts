/** DI token for the AccountStateReader port. */
export const ACCOUNT_STATE_READER = Symbol('AccountStateReader');

export interface AccountState {
  organizationStatus: string; // OrganizationStatus
  subscriptionStatus: string | null; // SubscriptionStatus or null if no subscription
}

/**
 * Reads the billing/account state of an organization so identity auth can gate
 * access (org suspended / subscription not in good standing). Impl in infra.
 */
export interface AccountStateReader {
  getByOrganization(organizationId: string): Promise<AccountState | null>;
}
