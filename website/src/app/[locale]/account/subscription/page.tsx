"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  useAccountSubscription,
  useSubscriptionHistory,
  usePlans,
  useChangePlan,
  planFeatures,
  accountQueryKeys,
  type PublicPlanResponse,
  type SubscriptionHistoryResponse,
} from "@/api/hooks";
import { Card, Row, StatusBadge, QueryState } from "@/components/account/ui";
import { HistoryList } from "@/components/account/HistoryList";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { useApiError } from "@/hooks/useApiError";

export default function SubscriptionPage() {
  const t = useTranslations("account.subscription");
  const tc = useTranslations("common");
  const locale = useLocale();
  const qc = useQueryClient();
  const sub = useAccountSubscription();
  const history = useSubscriptionHistory({ page: 1, limit: 20 });
  const plansQuery = usePlans();
  const changePlan = useChangePlan();
  const { toastError } = useApiError();

  const [pending, setPending] = useState<PublicPlanResponse | null>(null);

  const current = sub.data?.subscription;

  const unwrap = <T,>(value: unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : ((value as { data?: T[] } | undefined)?.data ?? []);

  const plans = unwrap<PublicPlanResponse>(plansQuery.data);
  const historyItems = unwrap<SubscriptionHistoryResponse>(history.data);

  const priceLabel = (amount?: number | null, currency?: string | null, interval?: string | null) =>
    amount != null && currency
      ? `${formatMoney(amount, currency, locale)}${interval ? tc("interval", { interval }) : ""}`
      : "—";

  async function confirmChange() {
    if (!pending) return;
    try {
      await changePlan.mutateAsync({ data: { planCode: pending.code } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: accountQueryKeys.subscription() }),
        qc.invalidateQueries({ queryKey: accountQueryKeys.overview() }),
        qc.invalidateQueries({ queryKey: accountQueryKeys.history() }),
      ]);
      toast.success(t("switchedToast", { plan: pending.name }), { description: t("switchedDesc") });
      setPending(null);
    } catch (err) {
      toastError(err, t("changeError"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <QueryState
        isLoading={sub.isLoading}
        isError={sub.isError}
        error={sub.error}
        onRetry={() => sub.refetch()}
      >
        <Card title={t("currentTitle")} action={<StatusBadge status={current?.status} />}>
          <dl className="grid gap-x-6 sm:grid-cols-2 lg:gap-x-10">
            <Row label={t("plan")}>{current?.planName ?? "—"}</Row>
            <Row label={t("price")}>
              {priceLabel(current?.priceAmount, current?.currency, current?.interval)}
            </Row>
            {current?.trialEndsAt ? (
              <Row label={t("trialEnds")}>{formatDate(current.trialEndsAt, locale)}</Row>
            ) : null}
            <Row label={t("periodEnds")}>{formatDate(current?.currentPeriodEnd, locale)}</Row>
          </dl>
        </Card>

        {/* Change plan */}
        <Card title={t("changeTitle")} description={t("changeDesc")}>
          {plansQuery.isLoading ? (
            <p className="text-sm text-muted">{t("loadingPlans")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.code === current?.planCode;
                return (
                  <div
                    key={plan.code}
                    className={cn(
                      "flex flex-col gap-3 rounded-xl border p-4",
                      isCurrent ? "border-terracotta/40 bg-terracotta-soft/40" : "border-line bg-cream",
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 font-display text-lg text-ink">{plan.name}</span>
                        {isCurrent ? (
                          <span className="shrink-0 rounded-pill bg-terracotta px-2 py-0.5 text-2xs font-semibold text-white">
                            {t("current")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-sm text-muted">
                        {formatMoney(plan.priceAmount, plan.currency, locale)}
                        {plan.interval ? tc("interval", { interval: plan.interval }) : ""}
                      </div>
                    </div>
                    <ul className="flex flex-1 flex-col gap-1.5 text-xs text-muted">
                      {planFeatures(plan)
                        .slice(0, 4)
                        .map((f) => (
                          <li key={f}>• {f}</li>
                        ))}
                    </ul>
                    <Button
                      type="button"
                      size="sm"
                      variant={isCurrent ? "ghost" : "secondary"}
                      disabled={isCurrent}
                      onClick={() => setPending(plan)}
                    >
                      {isCurrent ? t("currentPlan") : t("choose")}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* History */}
        <Card title={t("historyTitle")} description={t("historyDesc")}>
          <QueryState
            isLoading={history.isLoading}
            isError={history.isError}
            error={history.error}
            onRetry={() => history.refetch()}
          >
            <HistoryList items={historyItems.slice(0, 20)} />
          </QueryState>
        </Card>
      </QueryState>

      {/* Confirm dialog */}
      {pending ? (
        <ConfirmChange
          planName={pending.name}
          busy={changePlan.isPending}
          onCancel={() => setPending(null)}
          onConfirm={confirmChange}
        />
      ) : null}
    </div>
  );
}

function ConfirmChange({
  planName,
  busy,
  onCancel,
  onConfirm,
}: {
  planName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("account.subscription");
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogAria")}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-paper p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl text-ink">{t("dialogTitle", { plan: planName })}</h3>
        <p className="mt-2 text-sm text-muted">{t("dialogBody")}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} type="button" disabled={busy}>
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={onConfirm} type="button" disabled={busy}>
            {busy ? t("switching") : t("confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
