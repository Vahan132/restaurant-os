"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationsControllerList } from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import type { OrganizationSummaryResponse } from "@/api/generated/model";
import { PageHeader } from "@/components/layout/app-shell";
import { Button, Card, CardBody, EmptyState, ErrorState, StatusBadge } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { toList } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const PAGE_SIZE = 20;

export default function PaymentsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useOrganizationsControllerList({
    page,
    limit: PAGE_SIZE,
  });
  const list = useMemo(() => toList<OrganizationSummaryResponse>(data), [data]);

  return (
    <div>
      <PageHeader title="Payments" description="Billing and subscription overview." />

      <Card className="mb-6 border-yellow-200 bg-yellow-50">
        <CardBody>
          <p className="text-sm font-medium text-yellow-900">Payments/billing integration pending</p>
          <p className="mt-1 text-sm text-yellow-800">
            No payment processing is connected yet, so no transaction data is shown. Billing and
            subscription details are available on each organization&apos;s detail page.
          </p>
        </CardBody>
      </Card>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Organization</TH>
              <TH>Slug</TH>
              <TH>Status</TH>
              <TH>Billing</TH>
              <TH />
            </TR>
          </THead>
          {isLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : (
            <TBody>
              {list.items.map((o) => (
                <TR key={o.id} onClick={() => router.push(`/organizations/${o.id}`)}>
                  <TD className="font-medium text-gray-900">{o.name}</TD>
                  <TD className="font-mono text-xs">{o.slug}</TD>
                  <TD>
                    <StatusBadge status={o.status} />
                  </TD>
                  <TD>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Integration pending
                    </span>
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
                      View billing
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          )}
        </Table>

        {isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : !isLoading && list.items.length === 0 ? (
          <EmptyState title="No organizations" />
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
