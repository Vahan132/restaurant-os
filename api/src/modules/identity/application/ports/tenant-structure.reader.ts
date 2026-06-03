/** DI token for the TenantStructureReader port. */
export const TENANT_STRUCTURE_READER = Symbol('TenantStructureReader');

/**
 * Read-only checks against the tenancy backbone (Organization/Restaurant/Branch)
 * so the identity module can validate that a restaurant/branch belongs to the
 * acting organization WITHOUT importing the tenancy persistence directly.
 * Implemented in infrastructure via Prisma.
 */
export interface TenantStructureReader {
  /** True if the restaurant exists and belongs to the organization (not deleted). */
  restaurantInOrg(organizationId: string, restaurantId: string): Promise<boolean>;

  /** True if the branch exists and belongs to the restaurant (not deleted). */
  branchInRestaurant(restaurantId: string, branchId: string): Promise<boolean>;
}
