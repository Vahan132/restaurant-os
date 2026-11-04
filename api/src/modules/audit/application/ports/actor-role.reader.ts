import { AuditActorType } from '../../domain/enums';

export const ACTOR_ROLE_READER = Symbol('ActorRoleReader');

/**
 * Resolves an actor's ROLE CODE for the audit snapshot (best-effort). Only USER
 * actors have a role; PLATFORM_USER / SYSTEM actors resolve to null, as do
 * custom (non-system) roles whose `code` is null.
 */
export interface ActorRoleReader {
  resolve(actorType: AuditActorType, actorId: string | null): Promise<string | null>;
}
