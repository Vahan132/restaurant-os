"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSubscriptionsControllerChange,
} from "@/api/generated/endpoints/platform-subscriptions/platform-subscriptions";
import {
  usePlatformAdminControllerSubscriptionHistory,
  getPlatformAdminControllerSubscriptionHistoryQueryKey,
} from "@/api/generated/endpoints/platform/platform";
import { getOrganizationsControllerGetQueryKey } from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import type { PlanResponse, SubscriptionHistoryAdminResponse } from "@/api/generated/model";
import { Button, Card, CardBody, CardHeader, Field, Select, StatusBadge } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/lib/constants";
import { toList, formatDate, formatDateTime } from "@/lib/format";
import { pickString } from "@/lib/obj";
import { getErrorMessage } from "@/lib/errors";

export function SubscriptionPanel({
  orgId,
  subscription,
  plans,
}: {
  orgId: string;
  subscription: Record<string, unknown> | null;
  plans: PlanResponse[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const change = useSubscriptionsControllerChange();

  const currentPlanId = pickString(subscription, "planId", "plan_id");
  const currentStatus = pickString(subscription, "status");
  const currentPlanName =
    pickString(subscription, "planName", "plan_name") ??
    plans.find((p) => p.id === currentPlanId)?.name;
  const periodStart = pickString(subscription, "currentPeriodStart", "periodStart", "startedAt");
  const periodEnd = pickString(subscription, "currentPeriodEnd", "periodEnd");
  const trialEndsAt = pickString(subscription, "trialEndsAt");

  const [planId, setPlanId] = useState(currentPlanId ?? "");
  const [status, setStatus] = useState<string>(currentStatus ?? "");

  const dirty = planId !== (currentPlanId ?? "") || status !== (currentStatus ?? "");

  async function save() {
    try {
      await change.mutateAsync({
        id: orgId,
        data: {
          ...(planId && planId !== currentPlanId ? { planId } : {}),
          ...(status && status !== currentStatus ? { status: status as SubscriptionStatus } : {}),
        },
      });
      toast.success("Subscription updated");
      void queryClient.invalidateQueries({ queryKey: getOrganizationsControllerGetQueryKey(orgId) });
      void queryClient.invalidateQueries({
        queryKey: getPlatformAdminControllerSubscriptionHistoryQueryKey(orgId),
      });
    } catch (err) {
      toast.error("Update failed", getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Subscription" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Meta label="Plan" value={currentPlanName ?? "—"} />
            <Meta label="Status" value={<StatusBadge status={currentStatus} />} />
            <Meta label="Period start" value={periodStart ? formatDate(periodStart) : "—"} />
            <Meta label="Period end" value={periodEnd ? formatDate(periodEnd) : "—"} />
            {trialEndsAt ? <Meta label="Trial ends" value={formatDate(trialEndsAt)} /> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <Field label="Change plan">
              <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">— keep current —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}){!p.isActive ? " · inactive" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Change status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">— keep current —</option>
                {SUBSCRIPTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button onClick={save} loading={change.isPending} disabled={!dirty}>
                Apply changes
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <SubscriptionHistory orgId={orgId} />
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

function SubscriptionHistory({ orgId }: { orgId: string }) {
  const { data, isLoading } = usePlatformAdminControllerSubscriptionHistory(orgId, {
    page: 1,
    limit: 50,
  });
  const history = useMemo(() => toList<SubscriptionHistoryAdminResponse>(data).items, [data]);

  return (
    <Card>
      <CardHeader title="Subscription history" />
      <Table>
        <THead>
          <TR>
            <TH>When</TH>
            <TH>Plan</TH>
            <TH>Status</TH>
            <TH>Changed by</TH>
            <TH>Reason</TH>
          </TR>
        </THead>
        {isLoading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : (
          <TBody>
            {history.map((h) => (
              <TR key={h.id}>
                <TD className="whitespace-nowrap">{formatDateTime(h.createdAt)}</TD>
                <TD>
                  <Transition from={h.fromPlanName} to={h.toPlanName} />
                </TD>
                <TD>
                  <Transition
                    from={h.fromStatus}
                    to={h.toStatus}
                    render={(v) => <StatusBadge status={v} />}
                  />
                </TD>
                <TD>{h.changedByType}</TD>
                <TD className="text-gray-500">{h.reason ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        )}
      </Table>
      {!isLoading && history.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-gray-400">No history yet.</p>
      ) : null}
    </Card>
  );
}

function Transition({
  from,
  to,
  render,
}: {
  from?: string | null;
  to?: string | null;
  render?: (v: string) => React.ReactNode;
}) {
  const show = (v?: string | null) =>
    v ? (render ? render(v) : <span>{v}</span>) : <span className="text-gray-400">—</span>;
  if (!from && !to) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {show(from)}
      <span className="text-gray-400">→</span>
      {show(to)}
    </span>
  );
}
