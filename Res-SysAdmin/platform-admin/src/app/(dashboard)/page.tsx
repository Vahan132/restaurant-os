"use client";

import { usePlatformAdminControllerDashboard } from "@/api/generated/endpoints/platform/platform";
import { PageHeader } from "@/components/layout/app-shell";
import { Card, CardBody, CardHeader, ErrorState, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { SUBSCRIPTION_STATUSES } from "@/lib/constants";
import { getErrorMessage } from "@/lib/errors";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      </CardBody>
    </Card>
  );
}

function toNumber(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

function StatusBreakdown({
  title,
  data,
  order,
}: {
  title: string;
  data: Record<string, unknown> | undefined;
  order?: readonly string[];
}) {
  const entries = Object.entries(data ?? {});
  const sorted = order
    ? order.map((k) => [k, (data ?? {})[k] ?? 0] as const).filter(([, v]) => v !== undefined)
    : entries;
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400">No data</p>
        ) : (
          sorted.map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <StatusBadge status={status} />
              <span className="text-sm font-medium text-gray-900">{toNumber(count)}</span>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = usePlatformAdminControllerDashboard();

  return (
    <div>
      <PageHeader title="Dashboard" description="Platform-wide overview." />

      {isError ? (
        <Card>
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-3 h-7 w-16" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Organizations" value={data.totalOrganizations} />
            <StatCard label="Restaurants" value={data.totalRestaurants} />
            <StatCard label="Tables" value={data.totalTables} />
            <StatCard label="Users" value={data.totalUsers} />
            <StatCard label="New signups (7d)" value={data.newSignups.last7Days} />
            <StatCard label="New signups (30d)" value={data.newSignups.last30Days} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusBreakdown
              title="Organizations by status"
              data={data.organizationsByStatus as Record<string, unknown>}
            />
            <StatusBreakdown
              title="Subscriptions by status"
              data={data.subscriptionsByStatus as Record<string, unknown>}
              order={SUBSCRIPTION_STATUSES}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
