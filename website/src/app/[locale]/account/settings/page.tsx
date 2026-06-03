"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChangePassword } from "@/api/hooks";
import { useSession } from "@/hooks/useSession";
import { Card } from "@/components/account/ui";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { toast, toastError } from "@/lib/toast";

export default function SettingsPage() {
  const t = useTranslations("account.settings");
  const tv = useTranslations("validation");
  const { user } = useSession();
  const changePassword = useChangePassword();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (newPassword.length < 8) {
      setError(tv("password.min8"));
      return;
    }
    if (newPassword !== confirm) {
      setError(tv("confirm.mismatch"));
      return;
    }
    if (!user?.id) {
      toast.error(t("noUser"));
      return;
    }
    try {
      // The API's change-password DTO accepts only { newPassword }; the
      // current password is not verified server-side today.
      await changePassword.mutateAsync({ id: user.id, data: { newPassword } });
      setNewPassword("");
      setConfirm("");
      toast.success(t("toastSuccess"));
    } catch (err) {
      toastError(err, t("toastError"));
    }
  }

  const prefs = [
    { label: t("prefUpdates"), on: true },
    { label: t("prefDigest"), on: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card title={t("passwordTitle")} description={t("passwordDesc")}>
        <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-5">
          <Field label={t("newPassword")} htmlFor="newPassword" error={error} required>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              invalid={!!error}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <div className="mt-2">
              <PasswordStrength value={newPassword} />
            </div>
          </Field>
          <Field label={t("confirm")} htmlFor="confirm" required>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? t("updating") : t("update")}
            </Button>
          </div>
        </form>
      </Card>

      <Card title={t("prefsTitle")} description={t("prefsDesc")}>
        <ul className="flex flex-col gap-3">
          {prefs.map((pref) => (
            <li
              key={pref.label}
              className="flex items-center justify-between rounded-xl border border-line bg-cream/60 px-4 py-3"
            >
              <span className="text-sm text-ink-soft">{pref.label}</span>
              <span
                aria-hidden
                className={`relative h-5 w-9 rounded-pill transition-colors ${
                  pref.on ? "bg-terracotta/60" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow-xs transition-all ${
                    pref.on ? "left-[1.125rem]" : "left-0.5"
                  }`}
                />
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">{t("prefsNote")}</p>
      </Card>
    </div>
  );
}
