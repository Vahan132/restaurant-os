import { BaseDomainEvent } from '../../../../shared/domain/domain-event';

/** Identity domain events for roles (namespaced `identity.role.*`). */

/**
 * Raised when a role's permission set is replaced. The realtime relay bridges
 * this to a per-org socket broadcast so open POS/KDS sessions of users holding
 * the role refetch their permissions live (no re-login). Carries only ids —
 * clients re-resolve effective permissions over HTTP (GET /auth/me).
 */
export class RolePermissionsUpdatedEvent extends BaseDomainEvent {
  readonly eventName = 'identity.role.permissions_updated';
  constructor(
    public readonly roleId: string,
    public readonly organizationId: string,
  ) {
    super(roleId);
  }
}
