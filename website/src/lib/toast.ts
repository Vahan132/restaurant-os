import { toast } from "sonner";
import { normalizeError } from "@/api/http-client";

/** Show a normalized error toast from any thrown error. */
export function toastError(error: unknown, fallback?: string) {
  const { message } = normalizeError(error);
  toast.error(fallback ?? "Something went wrong", { description: message });
}

export { toast };
