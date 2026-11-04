"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationsControllerList } from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import type { OrganizationSummaryResponse } from "@/api/generated/model";
import { PageHeader } from "@/components/layout/app-shell";
import { Button, Card, EmptyState, ErrorState, Select, StatusBadge } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { toList } from "@/lib/format";
import { SUBSCRIPTION_STATUSES } from "@/lib/constants";
import { getErrorMessage } from "@/lib/errors";

/** Optional fields some deployments include on the org summary. */
type OrgRow = OrganizationSummaryResponse & {
  subscriptionStatus?: string | null;
  planName?: string | null;
  plan?: { name?: string | null } | null;
};

const PAGE_SIZE = 20;

export default function SubscriptionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  const { data, isLoading, isError, error, refetch } = useOrganizationsControllerList({
    page,
    limit: PAGE_SIZE,
  });
  const list = useMemo(() => toList<OrgRow>(data), [data]);

  const rows = useMemo(() => {
    if (!status) return list.items;
    return list.items.filter((o) => (o.subscriptionStatus ?? "").toUpperCase() === status);
  }, [list.items, status]);

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Organizations by subscription status. Open an organization to change plan or status."
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[200px]">
            <option value="">All subscription statuses</option>
            {SUBSCRIPTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500">
            Per-organization management lives in the organization detail page.
          </p>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Organization</TH>
              <TH>Slug</TH>
              <TH>Org status</TH>
              <TH>Plan</TH>
              <TH>Subscription</TH>
              <TH />
            </TR>
          </THead>
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : (
            <TBody>
              {rows.map((o) => (
                <TR key={o.id} onClick={() => router.push(`/organizations/${o.id}`)}>
                  <TD className="font-medium text-gray-900">{o.name}</TD>
                  <TD className="font-mono text-xs">{o.slug}</TD>
                  <TD>
                    <StatusBadge status={o.status} />
                  </TD>
                  <TD>{o.planName ?? o.plan?.name ?? "—"}</TD>
                  <TD>
                    {o.subscriptionStatus ? (
                      <StatusBadge status={o.subscriptionStatus} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/organizations/${o.id}`);
                      }}
                    >
                      Manage
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          )}
        </Table>

        {isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : !isLoading && rows.length === 0 ? (
          <EmptyState
            title="No organizations"
            description={status ? "No organizations with that subscription status on this page." : undefined}
          />
        ) : null}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          itemCount={list.items.length}
          meta={list.pagination}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}
