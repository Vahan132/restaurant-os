import { User } from '../entities/user';

/** DI token for the UserRepository port. */
export const USER_REPOSITORY = Symbol('UserRepository');

/**
 * UserRepository port (interface only; Prisma impl in infrastructure).
 *
 * Every method is TENANT-SCOPED: callers pass `organizationId` and the
 * implementation MUST filter by it so a user in org A can never read/modify a
 * user in org B. Soft-deleted users are excluded unless stated otherwise.
 */
export interface UserListFilter {
  organizationId: string;
  restaurantId?: string | null;
  search?: string;
  skip: number;
  take: number;
}

export interface UserRepository {
  /** Find an active (non-deleted) user by id within an organization. */
  findById(organizationId: string, id: string): Promise<User | null>;

  /** Find an active user by id across all organizations (password reset carries only a userId). */
  findByIdGlobal(id: string): Promise<User | null>;

  /** Find by email within an organization (used by login when org is known). */
  findByEmail(organizationId: string, email: string): Promise<User | null>;

  /**
   * Find a single active user by email across all organizations (used by login
   * on hosts that don't resolve to a tenant, e.g. localhost in dev). Returns
   * null if zero OR more than one match (ambiguous), so it never crosses tenants
   * silently.
   */
  findByEmailGlobalUnique(email: string): Promise<User | null>;

  /** True if the email already exists within the organization. */
  existsByEmail(organizationId: string, email: string): Promise<boolean>;

  /** Paginated, tenant-scoped listing + total count. */
  list(filter: UserListFilter): Promise<{ items: User[]; total: number }>;

  /** Insert a new user. */
  create(user: User): Promise<void>;

  /** Persist changes to an existing user. */
  update(user: User): Promise<void>;

  /** Soft-delete a user within an organization. */
  softDelete(organizationId: string, id: string): Promise<void>;
}
