export const PLATFORM_ADMIN_QUERY = Symbol('PlatformAdminQuery');

export interface HallView {
  id: string;
  name: string;
  tableCount: number;
}
export interface BranchView {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
}
export interface RestaurantWithHallsView {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  totalTables: number;
  halls: HallView[];
}
export interface SubscriptionHistoryAdminRow {
  id: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromPlanId: string | null;
  fromPlanName: string | null;
  toPlanId: string | null;
  toPlanName: string | null;
  changedByType: string;
  changedByUserId: string | null;
  reason: string | null;
  createdAt: string;
}
export interface PlatformUserRow {
  id: string;
  fullName: string;
  email: string;
  status: string;
  roleName: string | null;
  organization: { id: string; name: string };
  restaurant: { id: string; name: string } | null;
  createdAt: string;
  lastLoginAt: string | null;
}
export interface PlatformUsersFilter {
  organizationId?: string;
  search?: string;
  role?: string; // role code
  status?: string; // UserStatus
  skip: number;
  take: number;
}
export interface BillingInfoView {
  billingName: string | null;
  billingEmail: string | null;
  billingAddress: string | null;
  taxId: string | null;
}
export interface PlatformDashboard {
  totalOrganizations: number;
  organizationsByStatus: Record<string, number>;
  subscriptionsByStatus: Record<string, number>;
  totalRestaurants: number;
  totalTables: number;
  totalUsers: number;
  newSignups: { last7Days: number; last30Days: number };
}

/**
 * Cross-organization READ queries for the platform-admin panel. Implemented in
 * infrastructure with PrismaService directly (read model). Platform staff read
 * any org; soft-deleted rows are excluded. NOT tenant-scoped.
 */
export interface PlatformAdminQuery {
  orgRestaurants(organizationId: string): Promise<RestaurantWithHallsView[]>;
  /** Branches for a restaurant (FISCAL-4-FE tenant picker). */
  restaurantBranches(restaurantId: string): Promise<BranchView[]>;
  orgBilling(organizationId: string): Promise<BillingInfoView | null>;
  subscriptionHistory(
    organizationId: string,
    skip: number,
    take: number,
  ): Promise<{ items: SubscriptionHistoryAdminRow[]; total: number }>;
  users(filter: PlatformUsersFilter): Promise<{ items: PlatformUserRow[]; total: number }>;
  dashboard(): Promise<PlatformDashboard>;
}
