export const ACCOUNT_QUERY = Symbol('AccountQuery');

export interface PublicPlanView {
  code: string;
  name: string;
  priceAmount: number;
  currency: string;
  interval: string;
  features: unknown;
}
export interface AccountOverview {
  organization: { id: string; name: string; slug: string };
  restaurant: { id: string; slug: string } | null;
  subscription: {
    status: string;
    planCode: string | null;
    planName: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  } | null;
  owner: { fullName: string; email: string };
}
export interface AccountSubscriptionView {
  status: string;
  planCode: string | null;
  planName: string | null;
  priceAmount: number | null;
  currency: string | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  recentHistory: SubscriptionHistoryView[];
}
export interface SubscriptionHistoryView {
  id: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromPlanId: string | null;
  toPlanId: string | null;
  changedByType: string;
  reason: string | null;
  createdAt: string;
}
export interface BillingView {
  billingName: string | null;
  billingEmail: string | null;
  billingAddress: string | null;
  taxId: string | null;
}

/** Read-side queries for the account module (Prisma directly; org-scoped). */
export interface AccountQuery {
  activePlans(): Promise<PublicPlanView[]>;
  isSlugTaken(slug: string): Promise<boolean>;
  overview(organizationId: string, ownerUserId: string): Promise<AccountOverview | null>;
  subscriptionView(organizationId: string): Promise<AccountSubscriptionView | null>;
  billing(organizationId: string): Promise<BillingView | null>;
}
