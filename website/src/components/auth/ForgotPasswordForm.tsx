"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "./AuthShell";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useForgotPassword } from "@/api/hooks";
import { useApiError } from "@/hooks/useApiError";
import { clearableRegister } from "@/lib/form";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tv = useTranslations("validation");
  const [sent, setSent] = useState(false);
  const forgot = useForgotPassword();
  const { toastError } = useApiError();

  const schema = useMemo(
    () => z.object({ email: z.string().min(1, tv("email.required")).email(tv("email.invalid")) }),
    [tv],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), reValidateMode: "onSubmit" });
  const field = clearableRegister(register, errors, clearErrors);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync({ data: values });
    } catch (err) {
      // Non-enumerable by design — only surface true transport failures.
      toastError(err, t("toastError"));
      return;
    }
    // Always show the neutral confirmation regardless of whether the email exists.
    setSent(true);
  });

  if (sent) {
    return (
      <AuthShell
        title={t("sentTitle")}
        subtitle={t("sentSubtitle")}
        footer={
          <Link href="/login" className="font-semibold text-terracotta-ink hover:underline">
            {t("backToSignin")}
          </Link>
        }
      >
        <p className="rounded-xl border border-line bg-sage-soft/50 p-4 text-sm text-sage-deep">
          {t("sentBody")}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <Link href="/login" className="font-semibold text-terracotta-ink hover:underline">
          {t("backToSignin")}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label={t("email")} htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...field("email")}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
