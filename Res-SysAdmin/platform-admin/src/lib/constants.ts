export const SUBSCRIPTION_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "SUSPENDED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const ORG_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export const PLAN_INTERVALS = ["MONTH", "YEAR"] as const;
export type PlanInterval = (typeof PLAN_INTERVALS)[number];

export const PLATFORM_ROLES = ["SUPER_ADMIN", "SUPPORT"] as const;

/** Tone used by the StatusBadge component. */
export function statusTone(status?: string | null): "green" | "yellow" | "red" | "gray" | "blue" {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "green";
    case "TRIALING":
      return "blue";
    case "PAST_DUE":
      return "yellow";
    case "SUSPENDED":
    case "CANCELED":
    case "BLOCKED":
      return "red";
    default:
      return "gray";
  }
}

/** Default module options offered in the plan features editor. */
export const DEFAULT_MODULES = [
  "RESERVATIONS",
  "ORDERS",
  "MENU",
  "TABLES",
  "ANALYTICS",
  "PAYMENTS",
  "STAFF",
] as const;
