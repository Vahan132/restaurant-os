import { Role } from '../entities/role';

/** DI token for the RoleRepository port. */
export const ROLE_REPOSITORY = Symbol('RoleRepository');

/**
 * RoleRepository port (interface only; Prisma impl in infrastructure).
 * Every method is TENANT-SCOPED via `organizationId`.
 */
export interface RoleRepository {
  /** All roles within an organization. */
  list(organizationId: string): Promise<Role[]>;

  /** Find a role by id within an organization. */
  findById(organizationId: string, id: string): Promise<Role | null>;

  /** Find a role by its code within an organization. */
  findByCode(organizationId: string, code: string): Promise<Role | null>;

  /** True if a role with this code already exists within the organization. */
  existsByCode(organizationId: string, code: string): Promise<boolean>;

  create(role: Role): Promise<void>;

  update(role: Role): Promise<void>;

  /** Hard-delete a (non-system) role within an organization. */
  delete(organizationId: string, id: string): Promise<void>;

  /** Number of users currently assigned to a role (to block unsafe deletes). */
  countUsers(organizationId: string, roleId: string): Promise<number>;
}
