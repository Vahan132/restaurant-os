"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AuthShell } from "./AuthShell";
import { Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { useLogin } from "@/api/hooks";
import { useAuthStore, type SessionUser } from "@/stores/auth";
import { toast } from "@/lib/toast";
import { useApiError } from "@/hooks/useApiError";
import { clearableRegister } from "@/lib/form";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tv = useTranslations("validation");
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const login = useLogin();
  const { toastError } = useApiError();

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().min(1, tv("email.required")).email(tv("email.invalid")),
        password: z.string().min(1, tv("password.required")),
      }),
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
      const res = await login.mutateAsync({ data: values });
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user as unknown as SessionUser,
      });
      toast.success(t("toastSuccess"));
      const next = params.get("next");
      router.replace(next ? decodeURIComponent(next) : "/account");
    } catch (err) {
      toastError(err, t("toastError"));
    }
  });

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={t.rich("footer", {
        link: (chunks) => (
          <Link href="/signup" className="font-semibold text-terracotta-ink hover:underline">
            {chunks}
          </Link>
        ),
      })}
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
        <Field label={t("password")} htmlFor="password" error={errors.password?.message} required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...field("password")}
          />
        </Field>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-terracotta-ink hover:underline"
          >
            {t("forgot")}
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("submitting") : t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
