"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlansControllerList,
  usePlansControllerDeactivate,
  getPlansControllerListQueryKey,
} from "@/api/generated/endpoints/platform-plans/platform-plans";
import type { PlanResponse } from "@/api/generated/model";
import { PageHeader } from "@/components/layout/app-shell";
import { Button, Card, EmptyState, ErrorState, StatusBadge } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR, TableSkeleton } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { PlanFormDialog } from "@/components/plans/plan-form-dialog";
import { formatPrice } from "@/lib/money";
import { pickNumber } from "@/lib/obj";
import { getErrorMessage } from "@/lib/errors";
import { toList } from "@/lib/format";

export default function PlansPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = usePlansControllerList();
  const deactivate = usePlansControllerDeactivate();

  const [editing, setEditing] = useState<PlanResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<PlanResponse | null>(null);

  const plans = useMemo(() => toList<PlanResponse>(data).items, [data]);

  async function confirmDeactivate() {
    if (!toDeactivate) return;
    try {
      await deactivate.mutateAsync({ id: toDeactivate.id });
      toast.success("Plan deactivated");
      void queryClient.invalidateQueries({ queryKey: getPlansControllerListQueryKey() });
    } catch (err) {
      toast.error("Deactivation failed", getErrorMessage(err));
    } finally {
      setToDeactivate(null);
    }
  }

  function feature(plan: PlanResponse, key: string): string {
    const v = pickNumber(plan.features as Record<string, unknown>, key);
    return v === undefined ? "—" : String(v);
  }

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Subscription plans available to organizations."
        action={<Button onClick={() => setCreating(true)}>New plan</Button>}
      />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Code</TH>
              <TH>Name</TH>
              <TH>Price</TH>
              <TH>Restaurants</TH>
              <TH>Branches</TH>
              <TH>Users</TH>
              <TH>Active</TH>
              <TH />
            </TR>
          </THead>
          {isLoading ? (
            <TableSkeleton rows={4} cols={8} />
          ) : (
            <TBody>
              {plans.map((p) => (
                <TR key={p.id}>
                  <TD className="font-mono text-xs">{p.code}</TD>
                  <TD className="font-medium text-gray-900">{p.name}</TD>
                  <TD>{formatPrice(p.priceAmount, p.currency, p.interval)}</TD>
                  <TD>{feature(p, "maxRestaurants")}</TD>
                  <TD>{feature(p, "maxBranchesPerRestaurant")}</TD>
                  <TD>{feature(p, "maxUsers")}</TD>
                  <TD>
                    <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      {p.isActive ? (
                        <Button variant="danger" size="sm" onClick={() => setToDeactivate(p)}>
                          Deactivate
                        </Button>
                      ) : null}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          )}
        </Table>

        {isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        ) : !isLoading && plans.length === 0 ? (
          <EmptyState title="No plans yet" description="Create your first plan." />
        ) : null}
      </Card>

      {creating ? <PlanFormDialog open plan={null} onClose={() => setCreating(false)} /> : null}
      {editing ? <PlanFormDialog open plan={editing} onClose={() => setEditing(null)} /> : null}

      <ConfirmDialog
        open={!!toDeactivate}
        title="Deactivate plan?"
        message={
          <>
            Deactivating <strong>{toDeactivate?.name}</strong> hides it from new provisioning. Existing
            subscriptions are unaffected.
          </>
        }
        confirmLabel="Deactivate"
        tone="danger"
        loading={deactivate.isPending}
        onConfirm={confirmDeactivate}
        onCancel={() => setToDeactivate(null)}
      />
    </div>
  );
}
