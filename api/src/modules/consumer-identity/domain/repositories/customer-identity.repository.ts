export const CUSTOMER_IDENTITY_REPOSITORY = Symbol('CustomerIdentityRepository');

export type IdentityProvider = 'GOOGLE' | 'APPLE' | 'PHONE';

export interface CustomerIdentityRecord {
  id: string;
  customerAccountId: string;
  provider: IdentityProvider;
  subject: string;
  emailVerified: boolean;
}

export interface CustomerIdentityRepository {
  /** Find by the unique (provider, subject) — the find-or-link key. */
  findByProviderSubject(
    provider: IdentityProvider,
    subject: string,
  ): Promise<CustomerIdentityRecord | null>;
  findByAccountAndProvider(
    customerAccountId: string,
    provider: IdentityProvider,
  ): Promise<CustomerIdentityRecord | null>;
  create(input: {
    customerAccountId: string;
    provider: IdentityProvider;
    subject: string;
    emailVerified: boolean;
  }): Promise<void>;
  /** Repoint a PHONE identity to a new E.164 subject (phone change). */
  updateSubject(id: string, subject: string): Promise<void>;
}
