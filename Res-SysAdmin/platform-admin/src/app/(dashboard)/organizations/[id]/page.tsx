"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOrganizationsControllerGet,
  useOrganizationsControllerSuspendOrg,
  useOrganizationsControllerActivateOrg,
  getOrganizationsControllerGetQueryKey,
  getOrganizationsControllerListQueryKey,
} from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import {
  usePlatformAdminControllerOrgRestaurants,
  usePlatformAdminControllerOrgUsers,
} from "@/api/generated/endpoints/platform/platform";
import { usePlansControllerList } from "@/api/generated/endpoints/platform-plans/platform-plans";
import type {
  RestaurantWithHallsResponse,
  PlatformUserRowResponse,
  PlanResponse,
} from "@/api/generated/model";
import { PageHeader } from "@/components/layout/app-shell";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Skeleton,
  StatusBadge,
} from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { SubscriptionPanel } from "@/components/organizations/subscription-panel";
import { RestaurantVisibilityControl } from "@/components/organizations/suppression-control";
import { toList, formatDateTime } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const orgQuery = useOrganizationsControllerGet(id);
  const plansQuery = usePlansControllerList();

  if (orgQuery.isError) {
    return (
      <Card>
        <ErrorState message={getErrorMessage(orgQuery.error)} onRetry={() => orgQuery.refetch()} />
      </Card>
    );
  }

  const org = orgQuery.data;

  return (
    <div>
      <PageHeader
        title={org?.name ?? "Organization"}
        description={org ? `Slug: ${org.slug}` : undefined}
        action={
          <div className="flex items-center gap-3">
            <Link href="/organizations" className="text-sm text-brand-600">
              ← Back
            </Link>
            {org ? <SuspendActivate id={id} status={org.status} /> : null}
          </div>
        }
      />

      {orgQuery.isLoading || !org ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-wrap items-center gap-x-10 gap-y-3">
              <Meta label="Status" value={<StatusBadge status={org.status} />} />
              <Meta label="Restaurants" value={String(org.restaurants?.length ?? 0)} />
              <Meta
                label="Payments"
                value={org.paymentsEnabled ? "Enabled" : "Integration pending"}
              />
            </CardBody>
          </Card>

          <SubscriptionPanel
            orgId={id}
            subscription={org.subscription as Record<string, unknown> | null}
            plans={toList<PlanResponse>(plansQuery.data).items}
          />

          <RestaurantsSection orgId={id} />

          <OrgUsersSection orgId={id} />
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function SuspendActivate({ id, status }: { id: string; status: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const suspend = useOrganizationsControllerSuspendOrg();
  const activate = useOrganizationsControllerActivateOrg();
  const [confirm, setConfirm] = useState<null | "suspend" | "activate">(null);

  const isSuspended = status.toUpperCase() === "SUSPENDED";
  const pending = suspend.isPending || activate.isPending;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getOrganizationsControllerGetQueryKey(id) });
    void queryClient.invalidateQueries({ queryKey: getOrganizationsControllerListQueryKey() });
  }

  async function run() {
    try {
      if (confirm === "suspend") {
        await suspend.mutateAsync({ id });
        toast.success("Organization suspended");
      } else if (confirm === "activate") {
        await activate.mutateAsync({ id });
        toast.success("Organization activated");
      }
      invalidate();
    } catch (err) {
      toast.error("Action failed", getErrorMessage(err));
    } finally {
      setConfirm(null);
    }
  }

  return (
    <>
      {isSuspended ? (
        <Button variant="primary" onClick={() => setConfirm("activate")} loading={pending}>
          Activate
        </Button>
      ) : (
        <Button variant="danger" onClick={() => setConfirm("suspend")} loading={pending}>
          Suspend
        </Button>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "suspend" ? "Suspend organization?" : "Activate organization?"}
        message={
          confirm === "suspend"
            ? "Suspending blocks tenant access to this organization. You can re-activate later."
            : "This will restore tenant access to the organization."
        }
        confirmLabel={confirm === "suspend" ? "Suspend" : "Activate"}
        tone={confirm === "suspend" ? "danger" : "primary"}
        loading={pending}
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function RestaurantsSection({ orgId }: { orgId: string }) {
  const { data, isLoading, isError, error, refetch } = usePlatformAdminControllerOrgRestaurants(orgId);
  const restaurants = useMemo(() => toList<RestaurantWithHallsResponse>(data).items, [data]);

  return (
    <Card>
      <CardHeader title="Restaurants & halls" />
      {isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : isLoading ? (
        <CardBody>
          <Skeleton className="h-20 w-full" />
        </CardBody>
      ) : restaurants.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">No restaurants.</p>
      ) : (
        <CardBody className="space-y-4">
          {restaurants.map((r) => (
            <div key={r.id} className="rounded-md border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <span className="font-mono text-xs text-gray-500">{r.slug}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-sm text-gray-600">
                  {r.currency} · {r.totalTables} tables total
                </div>
              </div>
              <div className="border-b border-gray-100">
                <RestaurantVisibilityControl restaurantId={r.id} orgId={orgId} />
              </div>
              <div className="divide-y divide-gray-100">
                {r.halls.length === 0 ? (
                  <p className="px-4 py-2 text-sm text-gray-400">No halls.</p>
                ) : (
                  r.halls.map((h) => (
                    <div key={h.id} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="text-gray-700">{h.name}</span>
                      <span className="text-gray-500">{h.tableCount} tables</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </CardBody>
      )}
    </Card>
  );
}

function OrgUsersSection({ orgId }: { orgId: string }) {
  const { data, isLoading, isError, error, refetch } = usePlatformAdminControllerOrgUsers(orgId, {
    page: 1,
    limit: 50,
  });
  const users = useMemo(() => toList<PlatformUserRowResponse>(data).items, [data]);

  return (
    <Card>
      <CardHeader title="Users in organization" />
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH>Restaurant</TH>
            <TH>Last login</TH>
          </TR>
        </THead>
        {isLoading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : (
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium text-gray-900">{u.fullName}</TD>
                <TD>{u.email}</TD>
                <TD>{u.roleName ?? "—"}</TD>
                <TD>
                  <StatusBadge status={u.status} />
                </TD>
                <TD>{u.restaurant?.name ?? "—"}</TD>
                <TD>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        )}
      </Table>
      {isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : !isLoading && users.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">No users.</p>
      ) : null}
    </Card>
  );
}
