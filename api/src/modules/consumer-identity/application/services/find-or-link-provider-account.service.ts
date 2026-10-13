import { Inject, Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { CustomerAccount } from '../../domain/entities/customer-account';
import {
  CUSTOMER_ACCOUNT_REPOSITORY,
  CustomerAccountRepository,
} from '../../domain/repositories/customer-account.repository';
import {
  CUSTOMER_IDENTITY_REPOSITORY,
  CustomerIdentityRepository,
} from '../../domain/repositories/customer-identity.repository';
import { VerifiedProviderIdentity } from '../ports/provider-verifier';

/**
 * Find-or-create a CustomerAccount for a verified provider identity, applying the
 * linking rule:
 *   1. Known (provider, subject) → that account (capture any missing name/email).
 *   2. Else, if the provider asserts a VERIFIED email matching an existing account →
 *      LINK a new identity to it (one account, multiple identities).
 *   3. Else → a new standalone account.
 *
 * Apple private-relay / unverified emails arrive as emailVerified=false, so they
 * never auto-link and never get stored on the account (keeps the email unique index
 * meaningful). Returns the customerAccountId.
 */
@Injectable()
export class FindOrLinkProviderAccount {
  constructor(
    @Inject(CUSTOMER_ACCOUNT_REPOSITORY) private readonly accounts: CustomerAccountRepository,
    @Inject(CUSTOMER_IDENTITY_REPOSITORY) private readonly identities: CustomerIdentityRepository,
  ) {}

  async execute(identity: VerifiedProviderIdentity): Promise<string> {
    const linkableEmail = identity.emailVerified ? identity.email : null;

    // 1. Known identity.
    const existing = await this.identities.findByProviderSubject(
      identity.provider,
      identity.subject,
    );
    if (existing) {
      await this.captureMissing(existing.customerAccountId, identity.name, linkableEmail);
      return existing.customerAccountId;
    }

    // 2. Verified-email linking.
    if (linkableEmail) {
      const byEmail = await this.accounts.findByEmail(linkableEmail);
      if (byEmail) {
        await this.identities.create({
          customerAccountId: byEmail.id,
          provider: identity.provider,
          subject: identity.subject,
          emailVerified: true,
        });
        await this.captureMissing(byEmail.id, identity.name, linkableEmail);
        return byEmail.id;
      }
    }

    // 3. New standalone account.
    const id = createId();
    const account = CustomerAccount.create({
      id,
      name: identity.name ?? null,
      email: linkableEmail,
    });
    await this.accounts.save(account);
    await this.identities.create({
      customerAccountId: id,
      provider: identity.provider,
      subject: identity.subject,
      emailVerified: identity.emailVerified,
    });
    return id;
  }

  private async captureMissing(
    accountId: string,
    name: string | null,
    email: string | null,
  ): Promise<void> {
    if (!name && !email) return;
    const account = await this.accounts.findById(accountId);
    if (!account) return;
    account.fillMissingFromProvider({ name, email });
    await this.accounts.save(account);
  }
}
