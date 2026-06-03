export const BILLING_REPOSITORY = Symbol('BillingRepository');

export interface BillingInfo {
  organizationId: string;
  billingName: string | null;
  billingEmail: string | null;
  billingAddress: string | null;
  taxId: string | null;
}

export interface BillingRepository {
  upsert(input: {
    id: string;
    organizationId: string;
    billingName?: string | null;
    billingEmail?: string | null;
    billingAddress?: string | null;
    taxId?: string | null;
  }): Promise<BillingInfo>;
}
