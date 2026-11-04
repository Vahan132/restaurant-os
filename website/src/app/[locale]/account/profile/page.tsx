"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAccountOverview, useUpdateProfile, accountQueryKeys } from "@/api/hooks";
import { Card, QueryState } from "@/components/account/ui";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { useApiError } from "@/hooks/useApiError";

export default function ProfilePage() {
  const t = useTranslations("account.profile");
  const tv = useTranslations("validation");
  const qc = useQueryClient();
  const overview = useAccountOverview();
  const update = useUpdateProfile();
  const { toastError } = useApiError();

  const [fullName, setFullName] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string>();

  // Seed the field from the loaded profile (only until the user edits).
  useEffect(() => {
    if (overview.data && !touched) setFullName(overview.data.owner.fullName);
  }, [overview.data, touched]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (fullName.trim().length < 2) {
      setError(tv("fullName"));
      return;
    }
    try {
      await update.mutateAsync({ data: { fullName: fullName.trim() } });
      await qc.invalidateQueries({ queryKey: accountQueryKeys.overview() });
      setTouched(false);
      toast.success(t("toastSuccess"));
    } catch (err) {
      toastError(err, t("toastError"));
    }
  }

  return (
    <QueryState
      isLoading={overview.isLoading}
      isError={overview.isError}
      error={overview.error}
      onRetry={() => overview.refetch()}
    >
      <Card title={t("title")} description={t("desc")}>
        <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-5">
          <Field label={t("fullName")} htmlFor="fullName" error={error} required>
            <Input
              id="fullName"
              value={fullName}
              invalid={!!error}
              onChange={(e) => {
                setTouched(true);
                if (error) setError(undefined);
                setFullName(e.target.value);
              }}
              autoComplete="name"
            />
          </Field>
          <Field label={t("email")} htmlFor="email" hint={t("emailHint")}>
            <Input id="email" value={overview.data?.owner.email ?? ""} disabled readOnly />
          </Field>
          <div>
            <Button type="submit" disabled={update.isPending || !touched}>
              {update.isPending ? t("saving") : t("save")}
            </Button>
          </div>
        </form>
      </Card>
    </QueryState>
  );
}
