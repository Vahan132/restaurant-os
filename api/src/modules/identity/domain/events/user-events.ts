import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Identity domain events. Event names are namespaced `identity.<event>` so
 * listeners (e.g. the audit module, later) subscribe with
 * `@OnEvent('identity.user.created')`. Permissions changes propagate to clients
 * on next token refresh — see TokenService.
 */

export class UserCreatedEvent extends BaseDomainEvent {
  readonly eventName = 'identity.user.created';
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly email: string,
    public readonly roleId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(userId);
  }
}

export class UserLoggedInEvent extends BaseDomainEvent {
  readonly eventName = 'identity.user.logged_in';
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly at: Date,
    public readonly ip: string | null = null,
    public readonly userAgent: string | null = null,
  ) {
    super(userId, at);
  }
}

export class UserBlockedEvent extends BaseDomainEvent {
  readonly eventName = 'identity.user.blocked';
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(userId);
  }
}

export class UserUnblockedEvent extends BaseDomainEvent {
  readonly eventName = 'identity.user.unblocked';
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly actorUserId: string | null = null,
  ) {
    super(userId);
  }
}
