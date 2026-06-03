"use client";

/**
 * Thin, friendly wrappers over the orval-generated hooks.
 *
 * Screens import from here so they get stable, well-named hooks and don't
 * depend on the verbose `XxxController_method` codegen names. Regenerating the
 * client (`npm run generate:api`) only ever changes the right-hand side here.
 */
import {
  usePublicAccountControllerPlans,
  usePublicAccountControllerSubdomain,
  usePublicAccountControllerCreateAccount,
  getPublicAccountControllerPlansQueryKey,
} from "./generated/public/public";
import {
  useAuthControllerLogin,
  useAuthControllerForgotPassword,
  useAuthControllerResetPassword,
} from "./generated/auth/auth";
import {
  useAccountControllerAccount,
  useAccountControllerSubscription,
  useAccountControllerHistory,
  useAccountControllerBilling,
  useAccountControllerProfile,
  useAccountControllerChange,
  useAccountControllerBillingUpsert,
  getAccountControllerAccountQueryKey,
  getAccountControllerSubscriptionQueryKey,
  getAccountControllerHistoryQueryKey,
  getAccountControllerBillingQueryKey,
} from "./generated/account/account";
import { useUsersControllerSetPassword } from "./generated/users/users";

import type { PublicPlanResponse } from "./generated/model/publicPlanResponse";
import type { AccountControllerHistoryParams } from "./generated/model/accountControllerHistoryParams";

/* ----------------------------- Public ----------------------------------- */

export const usePlans = () => usePublicAccountControllerPlans();

export const useSubdomainAvailability = (slug: string, enabled: boolean) =>
  usePublicAccountControllerSubdomain(
    { slug },
    { query: { enabled, retry: false, staleTime: 30_000 } },
  );

export const useSignup = usePublicAccountControllerCreateAccount;

/* ----------------------------- Auth ------------------------------------- */

export const useLogin = useAuthControllerLogin;
export const useForgotPassword = useAuthControllerForgotPassword;
export const useResetPassword = useAuthControllerResetPassword;

/* ----------------------------- Account ---------------------------------- */

type QueryOpt = { enabled?: boolean };

export const useAccountOverview = (opts?: QueryOpt) =>
  useAccountControllerAccount({ query: { enabled: opts?.enabled } });

export const useAccountSubscription = (opts?: QueryOpt) =>
  useAccountControllerSubscription({ query: { enabled: opts?.enabled } });

export const useSubscriptionHistory = (params?: AccountControllerHistoryParams, opts?: QueryOpt) =>
  useAccountControllerHistory(params, { query: { enabled: opts?.enabled } });

export const useAccountBilling = (opts?: QueryOpt) =>
  useAccountControllerBilling({ query: { enabled: opts?.enabled } });

export const useUpdateProfile = useAccountControllerProfile;
export const useChangePlan = useAccountControllerChange;
export const useUpdateBilling = useAccountControllerBillingUpsert;
export const useChangePassword = useUsersControllerSetPassword;

/* --------------------------- Query keys --------------------------------- */

export const accountQueryKeys = {
  overview: getAccountControllerAccountQueryKey,
  subscription: getAccountControllerSubscriptionQueryKey,
  history: getAccountControllerHistoryQueryKey,
  billing: getAccountControllerBillingQueryKey,
  plans: getPublicAccountControllerPlansQueryKey,
};

/* ------------------------------ Helpers --------------------------------- */

/** Plan `features` is loosely typed as object in the spec; coerce to string[]. */
export function planFeatures(plan: Pick<PublicPlanResponse, "features">): string[] {
  return Array.isArray(plan.features) ? (plan.features as string[]) : [];
}

export interface BillingInfo {
  billingName?: string | null;
  billingEmail?: string | null;
  billingAddress?: string | null;
  taxId?: string | null;
}

/** Billing is `{ [k]: unknown } | null` in the spec; read it as BillingInfo. */
export function readBilling(billing: unknown): BillingInfo {
  const b = (billing ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    billingName: str(b.billingName),
    billingEmail: str(b.billingEmail),
    billingAddress: str(b.billingAddress),
    taxId: str(b.taxId),
  };
}

// Re-export the model types screens need.
export type { PublicPlanResponse } from "./generated/model/publicPlanResponse";
export type { SignupDto } from "./generated/model/signupDto";
export type { LoginDto } from "./generated/model/loginDto";
export type { AccountOverviewResponse } from "./generated/model/accountOverviewResponse";
export type { AccountSubscriptionSummary } from "./generated/model/accountSubscriptionSummary";
export type { AccountSubscriptionDetailResponse } from "./generated/model/accountSubscriptionDetailResponse";
export type { SubscriptionHistoryResponse } from "./generated/model/subscriptionHistoryResponse";
export type { BillingResponse } from "./generated/model/billingResponse";
export type { UserResponse } from "./generated/model/userResponse";
