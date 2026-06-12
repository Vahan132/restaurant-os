"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { normalizeError } from "@/api/http-client";

export function useApiError() {
  const t = useTranslations("errors");

  const message = (error: unknown): string => {
    const { code } = normalizeError(error);
    return t.has(code) ? t(code) : t("default");
  };

  const toastError = (error: unknown, title: string): void => {
    toast.error(title, { description: message(error) });
  };

  return { message, toastError };
}
