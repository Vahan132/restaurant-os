import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PROVIDER_VERIFIER, ProviderVerifier } from '../ports/provider-verifier';
import { FindOrLinkProviderAccount } from '../services/find-or-link-provider-account.service';
import { ConsumerSession, IssueConsumerSession } from '../services/issue-consumer-session.service';

export interface SignInWithAppleInput {
  idToken: string;
  /** Apple supplies name/email only on the FIRST authorization (sent by the app). */
  firstAuthName?: string | null;
  firstAuthEmail?: string | null;
}

/**
 * Verify an Apple ID token against Apple JWKS, find-or-link, issue a session.
 * Apple first-auth name/email are captured onto the account if currently absent
 * (Apple omits them on subsequent sign-ins). Private-relay emails stay standalone.
 */
@Injectable()
export class SignInWithAppleUseCase implements UseCase<SignInWithAppleInput, ConsumerSession> {
  constructor(
    @Inject(PROVIDER_VERIFIER) private readonly verifier: ProviderVerifier,
    private readonly findOrLink: FindOrLinkProviderAccount,
    private readonly issueSession: IssueConsumerSession,
  ) {}

  async execute(input: SignInWithAppleInput): Promise<ConsumerSession> {
    const identity = await this.verifier.verifyApple(input.idToken, input.firstAuthName);
    // Prefer the token's verified email; fall back to first-auth email only if the
    // token didn't carry one (still only linked when the token marks it verified).
    if (!identity.email && input.firstAuthEmail) {
      identity.email = input.firstAuthEmail;
    }
    const accountId = await this.findOrLink.execute(identity);
    return this.issueSession.execute(accountId);
  }
}
