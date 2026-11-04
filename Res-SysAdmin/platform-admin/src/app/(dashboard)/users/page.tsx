"use client";

import { useMemo, useState } from "react";
import {
  usePlatformAdminControllerUsers,
} from "@/api/generated/endpoints/platform/platform";
import { useOrganizationsControllerList } from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import type {
  PlatformUserRowResponse,
  OrganizationSummaryResponse,
  PlatformAdminControllerUsersStatus,
} from "@/api/generated/model";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, EmptyState, ErrorState, Input, Select, StatusBadge } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { toList, formatDate, formatDateTime } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { getErrorMessage } from "@/lib/errors";

const PAGE_SIZE = 25;

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"" | PlatformAdminControllerUsersStatus>("");
  const search = useDebounce(searchInput, 300);

  const orgsQuery = useOrganizationsControllerList({ page: 1, limit: 100 });
  const orgs = useMemo(() => toList<OrganizationSummaryResponse>(orgsQuery.data).items, [orgsQuery.data]);

  const { data, isLoading, isError, error, refetch } = usePlatformAdminControllerUsers({
    page,
    limit: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(organizationId ? { organizationId } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
  });

  const list = useMemo(() => toList<PlatformUserRowResponse>(data), [data]);

  function onFilterChange(fn: () => void) {
    setPage(1);
    fn();
  }

  return (
    <div>
      <PageHeader title="Users" description="All users across organizations." />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3">
          <Input
            placeholder="Search name or email…"
            value={searchInput}
            onChange={(e) => onFilterChange(() => setSearchInput(e.target.value))}
            className="max-w-xs"
          />
          <Select
            value={organizationId}
            onChange={(e) => onFilterChange(() => setOrganizationId(e.target.value))}
            className="max-w-[220px]"
          >
            <option value="">All organizations</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Role"
            value={role}
            onChange={(e) => onFilterChange(() => setRole(e.target.value))}
            className="max-w-[140px]"
          />
          <Select
            value={status}
            onChange={(e) =>
              onFilterChange(() => setStatus(e.target.value as "" | PlatformAdminControllerUsersStatus))
            }
            className="max-w-[150px]"
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="BLOCKED">BLOCKED</option>
          </Select>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH>Role</TH>
              <TH>Organization</TH>
              <TH>Last login</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          {isLoading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : (
            <TBody>
              {list.items.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium text-gray-900">{u.fullName}</TD>
                  <TD>{u.email}</TD>
                  <TD>
                    <StatusBadge status={u.status} />
                  </TD>
                  <TD>{u.roleName ?? "—"}</TD>
                  <TD>{u.organization?.name ?? "—"}</TD>
                  <TD>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</TD>
                  <TD>{formatDate(u.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          )}
        </Table>

        {isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : !isLoading && list.items.length === 0 ? (
          <EmptyState title="No users found" description="Try adjusting your filters." />
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
