"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOrganizationsControllerCreate,
  getOrganizationsControllerListQueryKey,
} from "@/api/generated/endpoints/platform-organizations/platform-organizations";
import { usePlansControllerList } from "@/api/generated/endpoints/platform-plans/platform-plans";
import type { ProvisionResponse, PlanResponse } from "@/api/generated/model";
import { Modal } from "@/components/ui/dialog";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { toList } from "@/lib/format";

const CURRENCIES = ["USD", "EUR", "GBP", "AMD", "RUB", "JPY"];
const LANGUAGES = ["en", "ru", "hy"];

export function ProvisionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const plansQuery = usePlansControllerList();
  const create = useOrganizationsControllerCreate();
  const [result, setResult] = useState<ProvisionResponse | null>(null);

  const [form, setForm] = useState({
    orgName: "",
    orgSlug: "",
    planCode: "",
    restaurantName: "",
    restaurantSlug: "",
    currency: "USD",
    defaultLanguage: "en",
    timezone: "UTC",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const activePlans = toList<PlanResponse>(plansQuery.data).items.filter((p) => p.isActive);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await create.mutateAsync({
        data: {
          org: { name: form.orgName, slug: form.orgSlug },
          planCode: form.planCode,
          restaurant: {
            name: form.restaurantName,
            slug: form.restaurantSlug,
            currency: form.currency,
            defaultLanguage: form.defaultLanguage || undefined,
            timezone: form.timezone || undefined,
          },
          owner: {
            fullName: form.ownerName,
            email: form.ownerEmail,
            password: form.ownerPassword ? form.ownerPassword : undefined,
          },
        },
      });
      setResult(res);
      toast.success("Account provisioned");
      void queryClient.invalidateQueries({ queryKey: getOrganizationsControllerListQueryKey() });
    } catch (err) {
      toast.error("Provisioning failed", getErrorMessage(err));
    }
  }

  function handleClose() {
    setResult(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Provision new account" widthClass="max-w-2xl">
      {result ? (
        <ProvisionResult result={result} onClose={handleClose} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <Section title="Organization">
            <Field label="Organization name" required>
              <Input value={form.orgName} onChange={set("orgName")} required />
            </Field>
            <Field label="Slug" required hint="Unique identifier, e.g. acme-foods">
              <Input value={form.orgSlug} onChange={set("orgSlug")} required />
            </Field>
            <Field label="Plan" required>
              <Select value={form.planCode} onChange={set("planCode")} required>
                <option value="" disabled>
                  {plansQuery.isLoading ? "Loading plans…" : "Select a plan"}
                </option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          <Section title="Restaurant">
            <Field label="Restaurant name" required>
              <Input value={form.restaurantName} onChange={set("restaurantName")} required />
            </Field>
            <Field label="Slug (subdomain)" required>
              <Input value={form.restaurantSlug} onChange={set("restaurantSlug")} required />
            </Field>
            <Field label="Currency" required>
              <Select value={form.currency} onChange={set("currency")} required>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Default language">
              <Select value={form.defaultLanguage} onChange={set("defaultLanguage")}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Timezone">
              <Input value={form.timezone} onChange={set("timezone")} placeholder="UTC" />
            </Field>
          </Section>

          <Section title="Owner">
            <Field label="Full name" required>
              <Input value={form.ownerName} onChange={set("ownerName")} required />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={form.ownerEmail} onChange={set("ownerEmail")} required />
            </Field>
            <Field label="Password" hint="Leave blank to auto-generate (shown once on success).">
              <Input
                type="text"
                value={form.ownerPassword}
                onChange={set("ownerPassword")}
                placeholder="Auto-generated if empty"
              />
            </Field>
          </Section>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!form.planCode}>
              Provision account
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function ProvisionResult({ result, onClose }: { result: ProvisionResponse; onClose: () => void }) {
  const toast = useToast();
  function copy() {
    void navigator.clipboard?.writeText(result.ownerPassword);
    toast.info("Password copied");
  }
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
        Account provisioned successfully.
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <Row label="Organization ID" value={result.organizationId} mono />
        <Row label="Restaurant ID" value={result.restaurantId} mono />
        <Row label="Owner user ID" value={result.ownerUserId} mono />
        <Row label="Owner email" value={result.ownerEmail} />
      </dl>
      <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4">
        <p className="text-sm font-medium text-yellow-900">
          {result.passwordGenerated ? "Generated owner password" : "Owner password"} — shown once
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded bg-white px-3 py-2 font-mono text-sm text-gray-900">
            {result.ownerPassword}
          </code>
          <Button type="button" variant="secondary" size="sm" onClick={copy}>
            Copy
          </Button>
        </div>
        <p className="mt-2 text-xs text-yellow-800">
          Store it now. It cannot be retrieved again.
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={mono ? "font-mono text-xs text-gray-800" : "text-gray-800"}>{value}</dd>
    </div>
  );
}
