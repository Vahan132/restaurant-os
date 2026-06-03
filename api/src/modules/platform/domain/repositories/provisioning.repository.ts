export const ORGANIZATION_PROVISIONING_REPOSITORY = Symbol('OrganizationProvisioningRepository');

/** A fully-built role row to insert during provisioning. */
export interface ProvisionRoleRow {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A fully-built (already hashed) owner user row to insert during provisioning. */
export interface ProvisionOwnerRow {
  id: string;
  organizationId: string;
  restaurantId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  roleId: string;
}

export interface ProvisionSpec {
  maxRestaurants: number;
  organization: { id: string; name: string; slug: string };
  subscription: {
    id: string;
    planId: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  };
  restaurant: {
    id: string;
    name: string;
    slug: string;
    currency: string;
    defaultLanguage: string;
    timezone: string;
  };
  settings: { id: string };
  roles: ProvisionRoleRow[];
  owner: ProvisionOwnerRow;
}

export interface ProvisionResult {
  organizationId: string;
  restaurantId: string;
  ownerUserId: string;
}

/**
 * Transactional provisioning of a brand-new account. The implementation MUST
 * create the organization, subscription, restaurant, restaurant-settings, the
 * system roles and the owner user inside ONE database transaction; any failure
 * rolls everything back. Enforces the plan's maxRestaurants.
 */
export interface OrganizationProvisioningRepository {
  provision(spec: ProvisionSpec): Promise<ProvisionResult>;
}
