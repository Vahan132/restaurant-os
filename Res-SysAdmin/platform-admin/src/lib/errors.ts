import type { NormalizedError } from "@/lib/api-client";

/** Extract a user-facing message from a normalized API error (or anything else). */
export function getErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err && typeof err === "object") {
    const e = err as Partial<NormalizedError> & { message?: string };
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return fallback;
}

export function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const e = err as Partial<NormalizedError>;
    if (typeof e.code === "string") return e.code;
  }
  return undefined;
}
