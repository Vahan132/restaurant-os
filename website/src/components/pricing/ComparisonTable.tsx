import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { plans, comparison } from "@/config/plans";
import { cn } from "@/lib/cn";

function Cell({ value, label }: { value: boolean | string; label: { included: string; notIncluded: string; resolve: (v: string) => string } }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-terracotta-soft text-terracotta-ink">
        <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" aria-hidden>
          <path
            d="M2.5 6.2 5 8.5l4.5-5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only">{label.included}</span>
      </span>
    ) : (
      <span className="text-line" aria-label={label.notIncluded}>
        <svg viewBox="0 0 12 12" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M3 6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  // Numeric literals render as-is; word values resolve through the catalog.
  const text = /^\d+$/.test(value) ? value : label.resolve(value);
  return <span className="text-sm font-medium text-ink-soft">{text}</span>;
}

export function ComparisonTable() {
  const t = useTranslations("plans");
  const tp = useTranslations("plans.items");
  const label = {
    included: t("comparison.included"),
    notIncluded: t("comparison.notIncluded"),
    resolve: (v: string) => t(`comparison.values.${v}`),
  };

  return (
    <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left">
        <caption className="sr-only">{t("comparison.caption")}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-2/5 px-3 pb-4 align-bottom sm:px-4">
              <span className="text-sm font-semibold text-muted">{t("comparison.header")}</span>
            </th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className="px-3 pb-4 text-center align-bottom sm:px-4">
                <span
                  className={cn("font-display text-lg", p.popular ? "text-terracotta-ink" : "text-ink")}
                >
                  {tp(`${p.id}.name`)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.map((group) => (
            <Fragment key={group.groupKey}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={plans.length + 1}
                  className="px-3 pb-2 pt-7 text-2xs font-semibold uppercase tracking-eyebrow text-terracotta-ink sm:px-4"
                >
                  {t(`comparison.groups.${group.groupKey}`)}
                </th>
              </tr>
              {group.rows.map((row, ri) => (
                <tr key={row.featureKey} className={cn(ri % 2 === 1 && "bg-sand/40")}>
                  <th
                    scope="row"
                    className="rounded-l-md border-b border-line px-3 py-3 text-left text-sm font-normal text-ink-soft sm:px-4"
                  >
                    {t(`comparison.rows.${row.featureKey}`)}
                  </th>
                  {plans.map((p) => (
                    <td
                      key={p.id}
                      className="border-b border-line px-3 py-3 text-center last:rounded-r-md sm:px-4"
                    >
                      <Cell value={row.values[p.id]} label={label} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
