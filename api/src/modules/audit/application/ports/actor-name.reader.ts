import { AuditActorType } from '../../domain/enums';

export const ACTOR_NAME_READER = Symbol('ActorNameReader');

/** Resolves an actor's display name for the audit snapshot (best-effort). */
export interface ActorNameReader {
  resolve(actorType: AuditActorType, actorId: string | null): Promise<string | null>;
}
