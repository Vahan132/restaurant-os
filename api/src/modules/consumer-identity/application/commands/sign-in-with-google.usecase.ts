import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { PROVIDER_VERIFIER, ProviderVerifier } from '../ports/provider-verifier';
import { FindOrLinkProviderAccount } from '../services/find-or-link-provider-account.service';
import { ConsumerSession, IssueConsumerSession } from '../services/issue-consumer-session.service';

export interface SignInWithGoogleInput {
  idToken: string;
}

/**
 * Verify a Google ID token against Google JWKS (server-side; never trusts client
 * claims), find-or-link the account, and issue a consumer session.
 */
@Injectable()
export class SignInWithGoogleUseCase implements UseCase<SignInWithGoogleInput, ConsumerSession> {
  constructor(
    @Inject(PROVIDER_VERIFIER) private readonly verifier: ProviderVerifier,
    private readonly findOrLink: FindOrLinkProviderAccount,
    private readonly issueSession: IssueConsumerSession,
  ) {}

  async execute(input: SignInWithGoogleInput): Promise<ConsumerSession> {
    const identity = await this.verifier.verifyGoogle(input.idToken);
    const accountId = await this.findOrLink.execute(identity);
    return this.issueSession.execute(accountId);
  }
}
