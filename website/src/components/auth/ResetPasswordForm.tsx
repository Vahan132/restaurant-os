"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AuthShell } from "./AuthShell";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { PasswordStrength } from "./PasswordStrength";
import { useResetPassword } from "@/api/hooks";
import { toast } from "@/lib/toast";
import { useApiError } from "@/hooks/useApiError";
import { clearableRegister } from "@/lib/form";

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const tv = useTranslations("validation");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const reset = useResetPassword();
  const { toastError } = useApiError();

  const schema = useMemo(
    () =>
      z
        .object({
          newPassword: z.string().min(8, tv("password.min8")),
          confirm: z.string().min(1, tv("confirm.required")),
        })
        .refine((v) => v.newPassword === v.confirm, {
          message: tv("confirm.mismatch"),
          path: ["confirm"],
        }),
    [tv],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), reValidateMode: "onSubmit" });
  const field = clearableRegister(register, errors, clearErrors);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reset.mutateAsync({ data: { token, newPassword: values.newPassword } });
      toast.success(t("toastSuccess"), { description: t("toastSuccessDesc") });
      router.replace("/login");
    } catch (err) {
      toastError(err, t("toastError"));
    }
  });

  if (!token) {
    return (
      <AuthShell
        title={t("invalidTitle")}
        subtitle={t("invalidSubtitle")}
        footer={
          <Link href="/forgot-password" className="font-semibold text-terracotta-ink hover:underline">
            {t("requestNew")}
          </Link>
        }
      >
        <Link href="/forgot-password" className="block">
          <Button size="lg" className="w-full">
            {t("requestNew")}
          </Button>
        </Link>
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
        <Field label={t("newPassword")} htmlFor="newPassword" error={errors.newPassword?.message} required>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            invalid={!!errors.newPassword}
            {...field("newPassword")}
          />
          <div className="mt-2">
            <PasswordStrength value={watch("newPassword") ?? ""} />
          </div>
        </Field>
        <Field label={t("confirm")} htmlFor="confirm" error={errors.confirm?.message} required>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            invalid={!!errors.confirm}
            {...field("confirm")}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
