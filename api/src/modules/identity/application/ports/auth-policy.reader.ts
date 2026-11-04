/** DI token for the AuthPolicyReader port. */
export const AUTH_POLICY_READER = Symbol('AuthPolicyReader');

export interface BranchIpPolicy {
  /** 'STRICT' | 'SOFT'. */
  mode: string;
  allowlist: string[];
}

/**
 * Reads cross-module security policy the identity login flow needs, WITHOUT
 * importing the restaurant module (mirrors BranchDirectoryReader). The Prisma
 * impl reads the `branches` and `restaurant_settings` tables directly.
 */
export interface AuthPolicyReader {
  /** Branch IP policy (mode + allowlist), or null if the branch is unknown. */
  getBranchIpPolicy(restaurantId: string, branchId: string): Promise<BranchIpPolicy | null>;

  /** Restaurant-level toggle: may admins sign in from any (non-enrolled) device? */
  allowsUnanchoredAdminLogin(restaurantId: string): Promise<boolean>;
}
