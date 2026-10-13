/** DI token for the StaffDirectoryReader port. */
export const STAFF_DIRECTORY_READER = Symbol('StaffDirectoryReader');

/** Minimal staff display info for the POS/KDS login picker. NEVER PIN data. */
export interface BranchStaffEntry {
  id: string;
  fullName: string;
  roleCode: string | null;
  roleName: string | null;
}

/**
 * Lists the staff who can sign in at a branch (for the login grid). Resolves both
 * all-branch-role users and branch members. Returns display info only.
 */
export interface StaffDirectoryReader {
  listBranchStaff(restaurantId: string, branchId: string): Promise<BranchStaffEntry[]>;
}
