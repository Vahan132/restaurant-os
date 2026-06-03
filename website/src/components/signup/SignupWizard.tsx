"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Stepper } from "./Stepper";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import {
  usePlans,
  useSubdomainAvailability,
  useSignup,
  planFeatures,
  type PublicPlanResponse,
} from "@/api/hooks";
import { useAuthStore, type SessionUser } from "@/stores/auth";
import { formatMoney } from "@/lib/money";
import { validateSlugFormat, slugify, SLUG_MIN, SLUG_MAX, type SlugReason } from "@/lib/slug";
import { buildCustomerUrl } from "@/lib/platform";
import { cn } from "@/lib/cn";
import { toast, toastError } from "@/lib/toast";

type Data = {
  ownerName: string;
  email: string;
  password: string;
  businessName: string;
  planCode: string;
  restaurantName: string;
  slug: string;
  currency: string;
  defaultLanguage: string;
  timezone: string;
  agreeTerms: boolean;
};

function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function SignupWizard() {
  const t = useTranslations("signup");
  const tv = useTranslations("validation");
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuthStore((s) => s.setSession);
  const signup = useSignup();

  const STEPS = [t("steps.account"), t("steps.plan"), t("steps.restaurant")];

  const accountSchema = useMemo(
    () =>
      z.object({
        ownerName: z.string().min(2, tv("ownerName")),
        email: z.string().min(1, tv("email.required")).email(tv("email.invalid")),
        password: z.string().min(8, tv("password.min8")),
        businessName: z.string().min(2, tv("businessName")),
      }),
    [tv],
  );
  const restaurantSchema = useMemo(
    () =>
      z.object({
        restaurantName: z.string().min(2, tv("restaurantName")),
        currency: z.string().min(1),
        defaultLanguage: z.string().min(1),
        timezone: z.string().min(1, tv("timezone")),
      }),
    [tv],
  );

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [data, setData] = useState<Data>(() => ({
    ownerName: "",
    email: "",
    password: "",
    businessName: "",
    planCode: params.get("plan") ?? "",
    restaurantName: "",
    slug: "",
    currency: "USD",
    defaultLanguage: "en",
    timezone:
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
    agreeTerms: false,
  }));

  const set = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  // --- Plans -------------------------------------------------------------
  const plansQuery = usePlans();
  const plans = (
    Array.isArray(plansQuery.data)
      ? plansQuery.data
      : (plansQuery.data as { data?: PublicPlanResponse[] } | undefined)?.data ?? []
  ) as PublicPlanResponse[];

  useEffect(() => {
    if (!data.planCode && plans.length) {
      const fromQuery = params.get("plan");
      const match = plans.find((p) => p.code === fromQuery);
      if (match) set({ planCode: match.code });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans.length]);

  // --- Subdomain availability -------------------------------------------
  const slugFormat = validateSlugFormat(data.slug);
  const debouncedSlug = useDebounced(data.slug);
  const checkEnabled = slugFormat.valid && debouncedSlug === data.slug && debouncedSlug.length >= 3;
  const availabilityQuery = useSubdomainAvailability(debouncedSlug, checkEnabled);

  const slugState = useMemo(() => {
    if (!data.slug) return { kind: "idle" as const };
    if (!slugFormat.valid) return { kind: "invalid" as const, reason: slugFormat.reason };
    if (debouncedSlug !== data.slug || availabilityQuery.isFetching)
      return { kind: "checking" as const };
    if (availabilityQuery.data) {
      return availabilityQuery.data.available
        ? { kind: "available" as const }
        : { kind: "unavailable" as const, reason: availabilityQuery.data.reason ?? "taken" };
    }
    return { kind: "idle" as const };
  }, [data.slug, slugFormat, debouncedSlug, availabilityQuery.isFetching, availabilityQuery.data]);

  // --- Step navigation ---------------------------------------------------
  function validateStep(target: number): boolean {
    setErrors({});
    if (step === 0) {
      const r = accountSchema.safeParse(data);
      if (!r.success) {
        setErrors(fieldErrors(r.error));
        return false;
      }
      if (!data.agreeTerms) {
        setErrors({ agreeTerms: tv("agreeTerms") });
        return false;
      }
    }
    if (step === 1) {
      if (!data.planCode) {
        toast.error(t("plan.chooseToContinue"));
        return false;
      }
    }
    if (step === 2 && target > 2) {
      const r = restaurantSchema.safeParse(data);
      if (!r.success) {
        setErrors(fieldErrors(r.error));
        return false;
      }
      if (slugState.kind !== "available") {
        setErrors({ slug: t("slug.pick") });
        return false;
      }
    }
    return true;
  }

  function next() {
    if (!validateStep(step + 1)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    if (!validateStep(3)) return;
    try {
      const res = await signup.mutateAsync({
        data: {
          ownerName: data.ownerName,
          email: data.email,
          password: data.password,
          businessName: data.businessName,
          planCode: data.planCode,
          restaurantName: data.restaurantName,
          slug: data.slug,
          currency: data.currency,
          defaultLanguage: data.defaultLanguage,
          timezone: data.timezone,
        },
      });
      setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user as unknown as SessionUser,
      });
      toast.success(t("toastSuccess"), { description: t("toastSuccessDesc") });
      router.replace("/account");
    } catch (err) {
      toastError(err, t("toastError"));
    }
  }

  return (
    <Container size="default" className="layer-up py-14 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 flex flex-col items-center gap-6 text-center">
          <span className="eyebrow">{t("eyebrow")}</span>
          <Stepper steps={STEPS} current={step} />
        </div>

        <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm sm:p-9">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <h1 className="font-display text-2xl">{t("account.title")}</h1>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("account.name")} htmlFor="ownerName" error={errors.ownerName} required>
                  <Input
                    id="ownerName"
                    value={data.ownerName}
                    invalid={!!errors.ownerName}
                    autoComplete="name"
                    onChange={(e) => set({ ownerName: e.target.value })}
                  />
                </Field>
                <Field
                  label={t("account.businessName")}
                  htmlFor="businessName"
                  error={errors.businessName}
                  required
                >
                  <Input
                    id="businessName"
                    value={data.businessName}
                    invalid={!!errors.businessName}
                    autoComplete="organization"
                    onChange={(e) => set({ businessName: e.target.value })}
                  />
                </Field>
              </div>
              <Field label={t("account.email")} htmlFor="email" error={errors.email} required>
                <Input
                  id="email"
                  type="email"
                  value={data.email}
                  invalid={!!errors.email}
                  autoComplete="email"
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
              <Field
                label={t("account.password")}
                htmlFor="password"
                error={errors.password}
                hint={t("account.passwordHint")}
                required
              >
                <Input
                  id="password"
                  type="password"
                  value={data.password}
                  invalid={!!errors.password}
                  autoComplete="new-password"
                  onChange={(e) => set({ password: e.target.value })}
                />
                <div className="mt-2">
                  <PasswordStrength value={data.password} />
                </div>
              </Field>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="agreeTerms" className="flex items-start gap-3 text-sm text-ink-soft">
                  <input
                    id="agreeTerms"
                    type="checkbox"
                    checked={data.agreeTerms}
                    aria-invalid={!!errors.agreeTerms || undefined}
                    onChange={(e) => set({ agreeTerms: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line text-terracotta accent-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta"
                  />
                  <span>
                    {t.rich("account.agree", {
                      terms: (chunks) => (
                        <Link
                          href="/legal/terms"
                          target="_blank"
                          className="font-semibold text-terracotta-ink hover:underline"
                        >
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link
                          href="/legal/privacy"
                          target="_blank"
                          className="font-semibold text-terracotta-ink hover:underline"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                {errors.agreeTerms ? (
                  <p className="text-xs font-medium text-terracotta-ink" role="alert">
                    {errors.agreeTerms}
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-5">
              <h1 className="font-display text-2xl">{t("plan.title")}</h1>
              <p className="text-sm text-muted">{t("plan.trialNote")}</p>
              {plansQuery.isLoading ? (
                <PlanSkeleton />
              ) : plansQuery.isError ? (
                <ErrorRetry onRetry={() => plansQuery.refetch()} />
              ) : (
                <div className="flex flex-col gap-3">
                  {plans.map((plan) => (
                    <PlanOption
                      key={plan.code}
                      plan={plan}
                      selected={data.planCode === plan.code}
                      onSelect={() => set({ planCode: plan.code })}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <h1 className="font-display text-2xl">{t("restaurant.title")}</h1>
              <Field
                label={t("restaurant.name")}
                htmlFor="restaurantName"
                error={errors.restaurantName}
                required
              >
                <Input
                  id="restaurantName"
                  value={data.restaurantName}
                  invalid={!!errors.restaurantName}
                  onChange={(e) => {
                    const name = e.target.value;
                    set(data.slug ? { restaurantName: name } : { restaurantName: name, slug: slugify(name) });
                  }}
                />
              </Field>

              <Field
                label={t("restaurant.subdomain")}
                htmlFor="slug"
                error={errors.slug}
                hint={t.rich("restaurant.subdomainHint", {
                  url: () => (
                    <span className="font-medium text-ink-soft">
                      {buildCustomerUrl(data.slug || t("restaurant.placeholder"))}
                    </span>
                  ),
                })}
                required
              >
                <Input
                  id="slug"
                  value={data.slug}
                  invalid={slugState.kind === "invalid" || slugState.kind === "unavailable"}
                  placeholder={t("restaurant.placeholder")}
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => set({ slug: slugify(e.target.value) })}
                />
                <SlugStatus state={slugState} />
              </Field>

              <div className="grid gap-5 sm:grid-cols-3">
                <Field label={t("restaurant.currency")} htmlFor="currency">
                  <Select
                    id="currency"
                    value={data.currency}
                    onChange={(e) => set({ currency: e.target.value })}
                    options={[
                      ["USD", "USD ($)"],
                      ["EUR", "EUR (€)"],
                      ["GBP", "GBP (£)"],
                      ["AMD", "AMD (֏)"],
                      ["RUB", "RUB (₽)"],
                    ]}
                  />
                </Field>
                <Field label={t("restaurant.language")} htmlFor="defaultLanguage">
                  <Select
                    id="defaultLanguage"
                    value={data.defaultLanguage}
                    onChange={(e) => set({ defaultLanguage: e.target.value })}
                    options={[
                      ["en", "English"],
                      ["hy", "Հայերեն"],
                      ["ru", "Русский"],
                    ]}
                  />
                </Field>
                <Field label={t("restaurant.timezone")} htmlFor="timezone" error={errors.timezone}>
                  <Input
                    id="timezone"
                    value={data.timezone}
                    invalid={!!errors.timezone}
                    onChange={(e) => set({ timezone: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="mt-9 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={back} type="button">
                ← {t("nav.back")}
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={next} type="button">
                {t("nav.continue")}
              </Button>
            ) : (
              <Button onClick={submit} type="button" disabled={signup.isPending}>
                {signup.isPending ? t("nav.creating") : t("nav.create")}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          {t.rich("signin", {
            link: (chunks) => (
              <Link href="/login" className="font-semibold text-terracotta-ink hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </Container>
  );
}

/* ------------------------------ pieces --------------------------------- */

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

function PlanOption({
  plan,
  selected,
  onSelect,
}: {
  plan: PublicPlanResponse;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("signup.plan");
  const ti = useTranslations("common");
  const locale = useLocale();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start justify-between gap-4 rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-terracotta bg-terracotta-soft/50 shadow-sm"
          : "border-line bg-cream hover:border-terracotta/40",
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-display text-lg text-ink">{plan.name}</span>
          {selected ? (
            <span className="rounded-pill bg-terracotta px-2 py-0.5 text-2xs font-semibold text-white">
              {t("selected")}
            </span>
          ) : null}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {planFeatures(plan)
            .slice(0, 4)
            .map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-terracotta/60" />
                {f}
              </li>
            ))}
        </ul>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-display text-2xl text-ink">
          {formatMoney(plan.priceAmount, plan.currency, locale)}
        </div>
        <div className="text-xs text-muted">
          {plan.interval ? ti("interval", { interval: plan.interval }) : null}
        </div>
      </div>
    </button>
  );
}

function PlanSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl border border-line bg-cream" />
      ))}
    </div>
  );
}

function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("signup.plan");
  const tc = useTranslations("account.query");
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-cream p-5">
      <p className="text-sm text-muted">{t("loadError")}</p>
      <Button variant="secondary" size="sm" onClick={onRetry} type="button">
        {tc("retry")}
      </Button>
    </div>
  );
}

type SlugStateValue =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "invalid"; reason?: SlugReason }
  | { kind: "unavailable"; reason?: string };

function SlugStatus({ state }: { state: SlugStateValue }) {
  const t = useTranslations("signup.slug");
  const tv = useTranslations("validation.slug");
  if (state.kind === "idle") return null;

  let text = "";
  let cls = "text-terracotta-ink";
  if (state.kind === "checking") {
    text = t("checking");
    cls = "text-muted";
  } else if (state.kind === "available") {
    text = t("available");
    cls = "text-sage-deep";
  } else if (state.kind === "invalid" && state.reason) {
    text = tv(state.reason, { min: SLUG_MIN, max: SLUG_MAX });
  } else if (state.kind === "unavailable") {
    const reason = state.reason === "reserved" || state.reason === "invalid" ? state.reason : "taken";
    text = tv(reason);
  }
  return <p className={cn("mt-1.5 text-xs font-medium", cls)}>{text}</p>;
}

function Select({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: [string, string][];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      className="w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base text-ink transition-colors hover:border-terracotta/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
