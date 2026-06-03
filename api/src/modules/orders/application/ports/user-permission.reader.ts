export const USER_PERMISSION_READER = Symbol('UserPermissionReader');

/**
 * Checks whether a user (in an organization) holds a permission — used to
 * validate that an approver actually has DISCOUNT_APPLY / ORDER_CANCEL.
 * Impl in infrastructure (reads the user's role permissions).
 */
export interface UserPermissionReader {
  userHasPermission(organizationId: string, userId: string, permission: string): Promise<boolean>;
}
