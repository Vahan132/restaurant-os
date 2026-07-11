"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlansControllerCreate,
  usePlansControllerUpdate,
  getPlansControllerListQueryKey,
} from "@/api/generated/endpoints/platform-plans/platform-plans";
import type { PlanResponse, PlanFeaturesDto } from "@/api/generated/model";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { PLAN_INTERVALS, DEFAULT_MODULES, type PlanInterval } from "@/lib/constants";
import { toMajor, toStored, currencyDecimals } from "@/lib/money";
import { pickNumber } from "@/lib/obj";
import { getErrorMessage } from "@/lib/errors";

const CURRENCIES = ["USD", "EUR", "GBP", "AMD", "RUB", "JPY"];

function readModules(features: Record<string, unknown> | undefined): string[] {
  const m = features?.enabledModules;
  return Array.isArray(m) ? m.filter((x): x is string => typeof x === "string") : [];
}

export function PlanFormDialog({
  open,
  plan,
  onClose,
}: {
  open: boolean;
  plan: PlanResponse | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const create = usePlansControllerCreate();
  const update = usePlansControllerUpdate();
  const isEdit = !!plan;

  const features = (plan?.features ?? undefined) as Record<string, unknown> | undefined;

  const [code, setCode] = useState(plan?.code ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [currency, setCurrency] = useState(plan?.currency ?? "USD");
  const [interval, setInterval] = useState<PlanInterval>((plan?.interval as PlanInterval) ?? "MONTH");
  const [price, setPrice] = useState<string>(
    plan ? String(toMajor(plan.priceAmount, plan.currency)) : "",
  );
  const [maxRestaurants, setMaxRestaurants] = useState<string>(
    String(pickNumber(features, "maxRestaurants") ?? 1),
  );
  const [maxBranches, setMaxBranches] = useState<string>(
    String(pickNumber(features, "maxBranchesPerRestaurant") ?? 1),
  );
  const [maxUsers, setMaxUsers] = useState<string>(String(pickNumber(features, "maxUsers") ?? 1));
  const [modules, setModules] = useState<string[]>(readModules(features));

  const moduleOptions = useMemo(() => {
    const set = new Set<string>([...DEFAULT_MODULES, ...modules]);
    return Array.from(set);
  }, [modules]);

  function toggleModule(m: string) {
    setModules((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const featuresDto: PlanFeaturesDto = {
      maxRestaurants: Number(maxRestaurants) || 0,
      maxBranchesPerRestaurant: Number(maxBranches) || 0,
      maxUsers: Number(maxUsers) || 0,
      enabledModules: modules,
    };
    const priceAmount = toStored(Number(price) || 0, currency);

    try {
      if (isEdit && plan) {
        await update.mutateAsync({
          id: plan.id,
          data: { name, priceAmount, currency, interval, features: featuresDto },
        });
        toast.success("Plan updated");
      } else {
        await create.mutateAsync({
          data: { code, name, priceAmount, currency, interval, features: featuresDto },
        });
        toast.success("Plan created");
      }
      void queryClient.invalidateQueries({ queryKey: getPlansControllerListQueryKey() });
      onClose();
    } catch (err) {
      toast.error(isEdit ? "Update failed" : "Create failed", getErrorMessage(err));
    }
  }

  const saving = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit plan" : "Create plan"} widthClass="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required hint={isEdit ? "Code can't be changed." : "Unique, e.g. PRO"}>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required disabled={isEdit} />
          </Field>
          <Field label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Currency" required>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={`Price (${currency}, major units)`}
            required
            hint={`Stored as minor units (${currencyDecimals(currency)} decimals).`}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </Field>
          <Field label="Interval" required>
            <Select value={interval} onChange={(e) => setInterval(e.target.value as PlanInterval)}>
              {PLAN_INTERVALS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Features</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Max restaurants">
              <Input type="number" min="0" value={maxRestaurants} onChange={(e) => setMaxRestaurants(e.target.value)} />
            </Field>
            <Field label="Max branches / restaurant">
              <Input type="number" min="0" value={maxBranches} onChange={(e) => setMaxBranches(e.target.value)} />
            </Field>
            <Field label="Max users">
              <Input type="number" min="0" value={maxUsers} onChange={(e) => setMaxUsers(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Enabled modules</p>
            <div className="flex flex-wrap gap-3">
              {moduleOptions.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={modules.includes(m)}
                    onChange={() => toggleModule(m)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
