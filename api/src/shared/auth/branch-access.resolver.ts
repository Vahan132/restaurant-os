/**
 * BranchAccessResolver — the cross-cutting contract for resolving a caller's
 * EFFECTIVE access at a branch (BR-1).
 *
 * Lives in the shared kernel (framework-free types) so the guard machinery here
 * and the implementation in the identity module can both depend on it without a
 * module cycle. The implementation (EffectiveBranchAccessService) is bound to
 * the token below inside IdentityModule; SecurityModule imports IdentityModule.
 *
 * Branch access (FIX-BR-1 + FIX-E):
 *   - all-branch role (role.allBranches, e.g. OWNER): access to EVERY active
 *     branch, with the user's own permission set.
 *   - everyone else: access to branch B = the user has a BranchMembership for B;
 *     effective perms at B = that membership role's permissions.
 * Restaurant-wide PERMISSIONS (role.code !== BRANCH_SCOPED) are a separate
 * dimension resolved at the restaurant level, NOT branch reach.
 */
export const BRANCH_ACCESS_RESOLVER = Symbol('BranchAccessResolver');

/** Identifies a caller + the branch being accessed. Tenant ids come from the JWT. */
export interface BranchAccessQuery {
  organizationId: string;
  restaurantId: string;
  userId: string;
  branchId: string;
}

/** Identifies a caller within a restaurant (no specific branch). */
export interface AccessibleBranchesQuery {
  organizationId: string;
  restaurantId: string;
  userId: string;
}

export interface BranchAccessResult {
  /** Whether the branch exists (active, non-deleted) within the restaurant. */
  branchExists: boolean;
  /** Whether the caller may access it (restaurant-wide OR a membership for it). */
  hasAccess: boolean;
  /** Effective permission keys at this branch (restaurant-wide ∪ branch role). */
  permissions: string[];
}

export interface AccessibleBranch {
  id: string;
  name: string;
  isDefault: boolean;
  /** Effective permission keys the caller holds at this branch. */
  permissions: string[];
}

export interface AccessibleBranchesResult {
  /**
   * True if the caller has the ALL-BRANCH capability (role.allBranches, FIX-E) —
   * `branches` then lists every active branch. Otherwise `branches` is the
   * explicit set of memberships the caller holds.
   */
  allBranches: boolean;
  /** The restaurant-wide permission set (empty for branch-scoped callers). */
  restaurantWidePermissions: string[];
  /** Branches the caller can access, each with their effective permissions. */
  branches: AccessibleBranch[];
  /** The caller's default branch id (or null if none is accessible). */
  defaultBranchId: string | null;
}

/** The caller's default branch + their effective permissions there. */
export interface DefaultBranchAccess {
  branchId: string;
  permissions: string[];
}

export interface BranchAccessResolver {
  /** Resolve access + effective permissions for one branch. */
  resolveForBranch(query: BranchAccessQuery): Promise<BranchAccessResult>;

  /** Resolve every branch the caller can access (for /auth/me + UI gating). */
  resolveAccessibleBranches(query: AccessibleBranchesQuery): Promise<AccessibleBranchesResult>;

  /**
   * Resolve the caller's DEFAULT branch + effective permissions there (BR-2 §0):
   * the restaurant default for all-branch users; the user's default/only
   * membership branch for branch-scoped users. Null if none is accessible.
   */
  resolveDefaultBranchAccess(query: AccessibleBranchesQuery): Promise<DefaultBranchAccess | null>;
}
