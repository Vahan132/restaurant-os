import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Restaurant security-policy domain events (3A). Namespaced `restaurant.*` so
 * the audit module subscribes with `@OnEvent('restaurant.branch.ip_policy_changed')`
 * and `@OnEvent('restaurant.admin_login_policy_changed')`. Raised by the
 * application layer after persistence (these carry actor/IP context, which is an
 * application concern, so they are published directly rather than off an
 * aggregate).
 */
export class BranchIpPolicyChangedEvent extends BaseDomainEvent {
  readonly eventName = 'restaurant.branch.ip_policy_changed';
  constructor(
    public readonly branchId: string,
    public readonly restaurantId: string,
    public readonly actorUserId: string | null,
    public readonly ipBindingMode: string,
    public readonly ipAllowlist: string[],
    public readonly ip: string | null = null,
  ) {
    super(branchId);
  }
}

export class AdminLoginPolicyChangedEvent extends BaseDomainEvent {
  readonly eventName = 'restaurant.admin_login_policy_changed';
  constructor(
    public readonly restaurantId: string,
    public readonly actorUserId: string | null,
    public readonly allowUnanchoredAdminLogin: boolean,
    public readonly ip: string | null = null,
  ) {
    super(restaurantId);
  }
}
