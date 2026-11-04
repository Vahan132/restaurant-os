import { Inject, Injectable } from '@nestjs/common';
import { EdgeConfigService } from '../../../../shared/edge/edge-config.service';
import { AccountSuspended } from '../application.errors';
import { ACCOUNT_STATE_READER, AccountStateReader } from '../ports/account-state.reader';

const GOOD_SUBSCRIPTION = new Set(['TRIALING', 'ACTIVE']);

/**
 * Connects billing to access: an organization may only authenticate if it is
 * ACTIVE and — when it HAS a subscription — that subscription is in good standing
 * (TRIALING or ACTIVE). A MISSING subscription (null relation) is NOT treated as
 * a suspension and must not throw ACCOUNT_SUSPENDED.
 *
 * Tradeoff (MVP): enforced at LOGIN and REFRESH only — not on every request —
 * so a suspension takes effect at most one access-token TTL (15m) later. This
 * keeps the hot path free of an extra DB read per request.
 */
@Injectable()
export class AccountStateChecker {
  constructor(
    @Inject(ACCOUNT_STATE_READER) private readonly reader: AccountStateReader,
    private readonly edge: EdgeConfigService,
  ) {}

  async assertGoodStanding(organizationId: string): Promise<void> {
    // OFF-5: the edge has no synced Subscription (billing is a cloud concern);
    // it trusts its synced users, so skip the billing gate when running on a hub.
    if (this.edge.isEdge) {
      return;
    }
    const state = await this.reader.getByOrganization(organizationId);
    if (!state) {
      // No such organization — reject.
      throw AccountSuspended();
    }
    const orgOk = state.organizationStatus === 'ACTIVE';
    // Only an EXISTING subscription with a bad status blocks access.
    const subscriptionBad =
      state.subscriptionStatus !== null && !GOOD_SUBSCRIPTION.has(state.subscriptionStatus);
    if (!orgOk || subscriptionBad) {
      throw AccountSuspended();
    }
  }
}
