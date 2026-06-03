"use client";

import { useLocale, useTranslations } from "next-intl";
import type { SubscriptionHistoryResponse } from "@/api/hooks";
import { formatDate, humanize } from "@/lib/format";

export function HistoryList({ items }: { items: SubscriptionHistoryResponse[] }) {
  const t = useTranslations("account.history");
  const ts = useTranslations("account.status");
  const locale = useLocale();

  // Localized status label with a humanized fallback for unknown values.
  const statusLabel = (value?: string | null) => {
    if (!value) return humanize(value);
    return ts.has(value) ? ts(value) : humanize(value);
  };

  const describe = (item: SubscriptionHistoryResponse): string => {
    const planChanged = item.fromPlanId && item.toPlanId && item.fromPlanId !== item.toPlanId;
    const statusChanged = item.fromStatus && item.toStatus && item.fromStatus !== item.toStatus;
    if (planChanged && statusChanged)
      return t("planStatusChanged", { status: statusLabel(item.toStatus) });
    if (planChanged) return t("planChanged");
    if (statusChanged) return t("statusChanged", { status: statusLabel(item.toStatus) });
    if (!item.fromStatus && item.toStatus)
      return t("started", { status: statusLabel(item.toStatus) });
    return t("updated");
  };

  const byType = (value: string) => (t.has(`by.${value}`) ? t(`by.${value}`) : value);

  if (!items.length) {
    return <p className="text-sm text-muted">{t("empty")}</p>;
  }
  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-4 border-b border-line py-3.5 last:border-0"
        >
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-terracotta/50" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{describe(item)}</p>
            {item.reason ? <p className="text-xs text-muted">{item.reason}</p> : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">{formatDate(item.createdAt, locale)}</p>
            <p className="text-2xs text-muted/80">{byType(item.changedByType)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
