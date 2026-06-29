/**
 * IAM seed (locked decision E).
 *
 * Roles: the system roles for the org (OWNER, MANAGER, CASHIER, WAITER,
 * KITCHEN_STAFF, CHEF, SOUS_CHEF, RECEPTIONIST + the BRANCH_SCOPED sentinel) are
 * provisioned from the real permissions catalog (capability KEYS, never role-name
 * strings). Capabilities are granted by key via SYSTEM_ROLE_PERMISSIONS; OWNER
 * carries all-branch reach (allBranches=true) — the break-glass dimension.
 *
 * Staff: 8 users with hashed passwords + minted PINs. Restaurant-wide users
 * (OWNER, MANAGER) hold a real restaurant role; branch-scoped users hold the
 * BRANCH_SCOPED sentinel as their User.roleId and gain access only through an
 * explicit BranchMembership whose roleId is their FUNCTIONAL role at that branch
 * (FIX-BR-1: branch access is always explicit). A couple are multi-branch
 * (manager + chef); the rest are single-branch.
 */
import { seedId } from '../ids';

export type BranchKey = 'flagship' | 'second';

export interface MembershipSeed {
  branch: BranchKey;
  /** System role CODE that is the user's functional role AT this branch. */
  roleCode: string;
}

export interface StaffSeed {
  slug: string;
  email: string;
  fullName: string;
  /** User.roleId role code: a real restaurant-wide role, or BRANCH_SCOPED. */
  userRoleCode: string;
  memberships: MembershipSeed[];
}

export const STAFF: StaffSeed[] = [
  {
    slug: 'owner',
    email: 'owner@tavern-ararat.am',
    fullName: 'Արամ Պետրոսյան',
    userRoleCode: 'OWNER',
    memberships: [
      { branch: 'flagship', roleCode: 'OWNER' },
      { branch: 'second', roleCode: 'OWNER' },
    ],
  },
  {
    slug: 'manager',
    email: 'gor.hakobyan@tavern-ararat.am',
    fullName: 'Գոռ Հակոբյան',
    userRoleCode: 'MANAGER',
    memberships: [
      { branch: 'flagship', roleCode: 'MANAGER' },
      { branch: 'second', roleCode: 'MANAGER' },
    ],
  },
  {
    slug: 'chef',
    email: 'armen.avagyan@tavern-ararat.am',
    fullName: 'Արմեն Ավագյան',
    userRoleCode: 'BRANCH_SCOPED',
    memberships: [
      { branch: 'flagship', roleCode: 'CHEF' },
      { branch: 'second', roleCode: 'CHEF' },
    ],
  },
  {
    slug: 'cashier-flagship',
    email: 'lilit.grigoryan@tavern-ararat.am',
    fullName: 'Լիլիթ Գրիգորյան',
    userRoleCode: 'BRANCH_SCOPED',
    memberships: [{ branch: 'flagship', roleCode: 'CASHIER' }],
  },
  {
    slug: 'waiter-flagship',
    email: 'davit.sargsyan@tavern-ararat.am',
    fullName: 'Դավիթ Սարգսյան',
    userRoleCode: 'BRANCH_SCOPED',
    memberships: [{ branch: 'flagship', roleCode: 'WAITER' }],
  },
  {
    slug: 'kitchen-flagship',
    email: 'hayk.mkrtchyan@tavern-ararat.am',
    fullName: 'Հայկ Մկրտչյան',
    userRoleCode: 'BRANCH_SCOPED',
    memberships: [{ branch: 'flagship', roleCode: 'KITCHEN_STAFF' }],
  },
  {
    slug: 'cashier-gyumri',
    email: 'ani.martirosyan@tavern-ararat.am',
    fullName: 'Անի Մարտիրոսյան',
    userRoleCode: 'BRANCH_SCOPED',
    memberships: [{ branch: 'second', roleCode: 'CASHIER' }],
  },
  {
    slug: 'waiter-gyumri',
    email: 'narek.vardanyan@tavern-ararat.am',
    fullName: 'Նարեկ Վարդանյան',
    userRoleCode: 'BRANCH_SCOPED',
    memberships: [{ branch: 'second', roleCode: 'WAITER' }],
  },
];

export const userId = (slug: string): string => seedId(`user:${slug}`);
export const membershipId = (slug: string, branch: BranchKey): string =>
  seedId(`membership:${slug}:${branch}`);
