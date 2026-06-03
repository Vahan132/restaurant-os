"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { normalizeError } from "@/api/http-client";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-line bg-paper p-6 shadow-sm sm:p-7", className)}>
      {(title || action) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="font-display text-xl text-ink">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

const statusTone: Record<string, string> = {
  TRIALING: "bg-sage-soft text-sage-deep",
  ACTIVE: "bg-terracotta-soft text-terracotta-ink",
  PAST_DUE: "bg-saffron/15 text-[#9a5a12]",
  CANCELED: "bg-sand text-muted",
  EXPIRED: "bg-sand text-muted",
};

export function StatusBadge({ status }: { status?: string | null }) {
  const t = useTranslations("account.status");
  const tone = (status && statusTone[status]) || "bg-sand text-muted";
  // Use a translated label for known statuses; fall back to humanized text.
  const known = status && status in statusTone;
  const label = known ? t(status as string) : humanize(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold",
        tone,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

/** Renders loading / error (incl. a clean 403) states; otherwise the children. */
export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("account.query");
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-6 text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-terracotta" />
        {t("loading")}
      </div>
    );
  }
  if (isError) {
    const { status, message } = normalizeError(error);
    if (status === 403) {
      return (
        <Card title={t("forbiddenTitle")}>
          <p className="text-sm text-muted">
            {t.rich("forbiddenBody", { b: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </Card>
      );
    }
    return (
      <Card title={t("errorTitle")}>
        <p className="text-sm text-muted">{message}</p>
        {onRetry ? (
          <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry} type="button">
            {t("retry")}
          </Button>
        ) : null}
      </Card>
    );
  }
  return <>{children}</>;
}
