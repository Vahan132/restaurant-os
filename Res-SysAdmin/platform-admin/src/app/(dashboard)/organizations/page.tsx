"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationsControllerList } from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import type { OrganizationSummaryResponse } from "@/api/generated/model";
import { PageHeader } from "@/components/layout/app-shell";
import { Button, Card, ErrorState, EmptyState, Input, Select, StatusBadge } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ProvisionDialog } from "@/components/organizations/provision-dialog";
import { toList, formatDate } from "@/lib/format";
import { ORG_STATUSES } from "@/lib/constants";
import { getErrorMessage } from "@/lib/errors";

/**
 * The list endpoint (GET /platform/organizations) is documented with only
 * page/limit. Some deployments also return plan / subscription status / created
 * on the summary; we render those when present via this optional extension.
 */
type OrgRow = OrganizationSummaryResponse & {
  planName?: string | null;
  plan?: { name?: string | null } | null;
  subscriptionStatus?: string | null;
  createdAt?: string | null;
};

const PAGE_SIZE = 20;

export default function OrganizationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [provisionOpen, setProvisionOpen] = useState(false);

  const { data, isLoading, isError, error, refetch } = useOrganizationsControllerList({
    page,
    limit: PAGE_SIZE,
  });

  const list = useMemo(() => toList<OrgRow>(data), [data]);

  // Org status + name/slug search are filtered client-side (not exposed by the API).
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.items.filter((o) => {
      const matchesStatus = !status || (o.status ?? "").toUpperCase() === status;
      const matchesSearch =
        !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [list.items, search, status]);

  function planName(o: OrgRow): string {
    return o.planName ?? o.plan?.name ?? "—";
  }

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="All tenant organizations on the platform."
        action={<Button onClick={() => setProvisionOpen(true)}>Provision new account</Button>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3">
          <Input
            placeholder="Search name or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[160px]">
            <option value="">All statuses</option>
            {ORG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Slug</TH>
              <TH>Status</TH>
              <TH>Plan</TH>
              <TH>Subscription</TH>
              <TH>Created</TH>
              <TH />
            </TR>
          </THead>
          {isLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : (
            <TBody>
              {rows.map((o) => (
                <TR key={o.id} onClick={() => router.push(`/organizations/${o.id}`)}>
                  <TD className="font-medium text-gray-900">{o.name}</TD>
                  <TD className="font-mono text-xs">{o.slug}</TD>
                  <TD>
                    <StatusBadge status={o.status} />
                  </TD>
                  <TD>{planName(o)}</TD>
                  <TD>
                    {o.subscriptionStatus ? (
                      <StatusBadge status={o.subscriptionStatus} />
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TD>
                  <TD>{o.createdAt ? formatDate(o.createdAt) : "—"}</TD>
                  <TD className="text-right">
                    <span className="text-sm text-brand-600">View →</span>
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
            title="No organizations found"
            description={search || status ? "Try adjusting your filters." : "Provision a new account to get started."}
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

      <ProvisionDialog open={provisionOpen} onClose={() => setProvisionOpen(false)} />
    </div>
  );
}
