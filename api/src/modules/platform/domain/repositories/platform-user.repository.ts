import { PlatformUser } from '../entities/platform-user';

export const PLATFORM_USER_REPOSITORY = Symbol('PlatformUserRepository');

/** Cross-tenant: keyed by global email / id (NO organizationId). */
export interface PlatformUserRepository {
  findById(id: string): Promise<PlatformUser | null>;
  findByEmail(email: string): Promise<PlatformUser | null>;
  update(user: PlatformUser): Promise<void>;
}
