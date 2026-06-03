"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  useAccountBilling,
  useUpdateBilling,
  readBilling,
  accountQueryKeys,
  type BillingInfo,
} from "@/api/hooks";
import { Card, QueryState } from "@/components/account/ui";
import { HistoryList } from "@/components/account/HistoryList";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { toast, toastError } from "@/lib/toast";

const empty: BillingInfo = { billingName: "", billingEmail: "", billingAddress: "", taxId: "" };

export default function BillingPage() {
  const t = useTranslations("account.billing");
  const qc = useQueryClient();
  const billing = useAccountBilling();
  const update = useUpdateBilling();

  const [form, setForm] = useState<BillingInfo>(empty);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (billing.data && !touched) {
      const b = readBilling(billing.data.billing);
      setForm({
        billingName: b.billingName ?? "",
        billingEmail: b.billingEmail ?? "",
        billingAddress: b.billingAddress ?? "",
        taxId: b.taxId ?? "",
      });
    }
  }, [billing.data, touched]);

  const set = (patch: Partial<BillingInfo>) => {
    setTouched(true);
    setForm((f) => ({ ...f, ...patch }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({
        data: {
          billingName: form.billingName || undefined,
          billingEmail: form.billingEmail || undefined,
          billingAddress: form.billingAddress || undefined,
          taxId: form.taxId || undefined,
        },
      });
      await qc.invalidateQueries({ queryKey: accountQueryKeys.billing() });
      setTouched(false);
      toast.success(t("toastSuccess"));
    } catch (err) {
      toastError(err, t("toastError"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <QueryState
        isLoading={billing.isLoading}
        isError={billing.isError}
        error={billing.error}
        onRetry={() => billing.refetch()}
      >
        <Card title={t("title")} description={t("desc")}>
          <form onSubmit={onSubmit} className="grid max-w-xl gap-5 sm:grid-cols-2">
            <Field label={t("name")} htmlFor="billingName">
              <Input
                id="billingName"
                value={form.billingName ?? ""}
                onChange={(e) => set({ billingName: e.target.value })}
              />
            </Field>
            <Field label={t("email")} htmlFor="billingEmail">
              <Input
                id="billingEmail"
                type="email"
                value={form.billingEmail ?? ""}
                onChange={(e) => set({ billingEmail: e.target.value })}
              />
            </Field>
            <Field label={t("address")} htmlFor="billingAddress" className="sm:col-span-2">
              <Input
                id="billingAddress"
                value={form.billingAddress ?? ""}
                onChange={(e) => set({ billingAddress: e.target.value })}
              />
            </Field>
            <Field label={t("taxId")} htmlFor="taxId">
              <Input
                id="taxId"
                value={form.taxId ?? ""}
                onChange={(e) => set({ taxId: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={update.isPending || !touched}>
                {update.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </Card>

        {/* Invoices placeholder */}
        <Card title={t("invoicesTitle")}>
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-line bg-cream/60 p-6">
            <span className="rounded-pill bg-sage-soft px-2.5 py-1 text-2xs font-semibold uppercase tracking-eyebrow text-sage-deep">
              {t("comingSoon")}
            </span>
            <p className="text-sm text-muted">{t("invoicesBody")}</p>
          </div>
        </Card>

        {/* History */}
        <Card title={t("historyTitle")}>
          <HistoryList items={billing.data?.subscriptionHistory ?? []} />
        </Card>
      </QueryState>
    </div>
  );
}
