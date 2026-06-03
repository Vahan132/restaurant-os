"use client";

import { useLocale, useTranslations } from "next-intl";
import { useAccountOverview } from "@/api/hooks";
import { Card, Row, StatusBadge, QueryState } from "@/components/account/ui";
import { ButtonLink } from "@/components/ui/Button";
import { platformUrls, buildCustomerUrl } from "@/lib/platform";
import { formatDate } from "@/lib/format";

export default function AccountOverviewPage() {
  const { data, isLoading, isError, error, refetch } = useAccountOverview();

  return (
    <div className="flex flex-col gap-6">
      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {data ? <Overview data={data} /> : null}
      </QueryState>
    </div>
  );
}

function Overview({ data }: { data: NonNullable<ReturnType<typeof useAccountOverview>["data"]> }) {
  const t = useTranslations("account.overview");
  const locale = useLocale();
  const slug = data.restaurant.slug;
  const sub = data.subscription;

  const links = [
    { label: t("links.admin"), desc: t("links.adminDesc"), href: platformUrls.admin },
    { label: t("links.pos"), desc: t("links.posDesc"), href: platformUrls.pos },
    { label: t("links.kds"), desc: t("links.kdsDesc"), href: platformUrls.kds },
    { label: t("links.customer"), desc: t("links.customerDesc"), href: buildCustomerUrl(slug) },
  ].filter((l) => l.href);

  return (
    <>
      {/* Welcome / status */}
      <Card
        title={data.organization.name}
        description={t.rich("menuLivesAt", {
          url: () => <span className="font-medium text-ink-soft">{buildCustomerUrl(slug)}</span>,
        })}
        action={<StatusBadge status={sub.status} />}
      >
        <dl className="grid gap-x-10 sm:grid-cols-2">
          <Row label={t("plan")}>{sub.planName}</Row>
          <Row label={t("status")}>{<StatusBadge status={sub.status} />}</Row>
          {sub.trialEndsAt ? (
            <Row label={t("trialEnds")}>{formatDate(sub.trialEndsAt, locale)}</Row>
          ) : null}
          <Row label={t("periodEnds")}>{formatDate(sub.currentPeriodEnd, locale)}</Row>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <ButtonLink href="/account/subscription" size="sm">
            {t("manageSub")}
          </ButtonLink>
          <ButtonLink href="/account/billing" variant="secondary" size="sm">
            {t("billing")}
          </ButtonLink>
        </div>
      </Card>

      {/* Platform links */}
      <Card title={t("platformTitle")} description={t("platformDesc")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-cream p-4 transition-all hover:-translate-y-0.5 hover:border-terracotta/40 hover:shadow-sm"
            >
              <div>
                <div className="font-medium text-ink">{l.label}</div>
                <div className="text-xs text-muted">{l.desc}</div>
              </div>
              <span
                aria-hidden
                className="text-terracotta-ink transition-transform group-hover:translate-x-1"
              >
                ↗
              </span>
            </a>
          ))}
        </div>
      </Card>

      {/* Owner */}
      <Card title={t("ownerTitle")}>
        <dl>
          <Row label={t("ownerName")}>{data.owner.fullName}</Row>
          <Row label={t("ownerEmail")}>{data.owner.email}</Row>
        </dl>
        <ButtonLink href="/account/profile" variant="ghost" size="sm" className="mt-4 -ml-3">
          {t("editProfile")} →
        </ButtonLink>
      </Card>
    </>
  );
}
