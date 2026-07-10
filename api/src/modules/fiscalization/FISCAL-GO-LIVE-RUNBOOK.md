# Fiscalization go-live runbook (#2 — SRC + accountant)

Not code. This is the external gate: what to ask SRC, what the accountant supplies,
and the per-restaurant onboarding — each mapped to the field/endpoint in our build
that consumes it. **The code is done; three things stand between us and a real
fiscal receipt: #1 (shared IP), #2 (test access), #5 (ATG codes on every dish).**

---

## A. HARD BLOCKERS — only SRC can answer (nothing goes live until resolved)

### 1. Shared platform IP for many taxpayers — THE decision (ask first)
u6 field 5.2 wants "the real IP of the party making the request"; error 403 rejects
a mismatched IP. Our cloud makes the request for every restaurant.

> **Ask SRC (verbatim):** "Our platform fiscalizes on behalf of many restaurants
> from a single cloud server. Can multiple taxpayers' e-HDM registrations all list
> our platform server's IP as the requesting IP in u6 §5.2, or must each
> registration use the taxpayer's own branch IP? If the latter, is there any
> allowlist/proxy arrangement for a SaaS provider?"

- **"Our IP is fine" →** e-HDM runs from the cloud — exactly what's built. ✅ No change.
- **"Must be the taxpayer's IP" →** e-HDM must originate from each branch (on-prem
  hub / FISCAL-3). The adapter code is deployment-agnostic and unchanged, but *where*
  it runs flips. ⚠️ **Get this answer before anything else — it decides the topology.**

### 2. Test-environment network access
Test endpoint `https://10.3.14.123:447` is a private IP — unreachable from the open
internet.

> **Ask SRC:** "How do we get network access to the e-HDM test system at
> `10.3.14.123:447` — VPN, IP allowlist, or a jump host? We need it to
> integration-test before go-live."

Until this lands, only offline verification is possible (which is green:
`verify:ehdm` 15/15, `verify:fiscal-config` 12/12). Feeds `FISCAL_SRC_CA_PATH` +
the test-vs-prod `environment` toggle already in the config UI.

### 3. On-screen (digital) receipt acceptance
The manual says the fiscal QR "must be printed." For QR/app orders we **show it on
the customer's phone** instead. **Our code already assumes on-screen is valid** —
FISCAL-1b renders the returned `fiscalQr` as a `QRCodeSVG` in the customer receipt
view. #3 validates that assumption.

> **Ask SRC/accountant:** "For QR-menu and app orders, is displaying the fiscal QR
> on the customer's own screen an accepted receipt, or must a paper receipt be
> printed?"

- If on-screen accepted → no change. If paper required → we'd need a print path
  (bigger change; flag early).

---

## B. ACCOUNTANT — per restaurant (config + classification)

### 4. Tax regime per restaurant → `FiscalDepartment.taxRegime`
Regimes: 1 = VAT, 2 = non-VAT, 3 = turnover tax, 7 = micro-business. The accountant
says which regime each restaurant/department is. Entered in the platform-admin
fiscal-config UI (department map: `dep → taxRegime`), stored in `FiscalDepartment`.
The adapter reads this map to stamp each line's `dep`.

### 5. ATG (adgCode) classification of every dish → `MenuItem.adgCode` (THE data gap)
Every sold item needs an ATG code from SRC lists **N 1406-Ն** and **N 875-Ն**
(src.am → Electronic Services → New-Generation Cash Registers). Errors 183/192
reject any item without a valid code, and our adapter **fails closed pre-flight** on
a null-adgCode line. Today only 2 seeded dishes have illustrative codes; the rest
are null. **Task:** download the two lists, assign the correct ATG code to every
dish, enter into `MenuItem.adgCode`. Without this, every order fail-closes — this is
the single biggest data task.

---

## C. ONBOARDING RUNBOOK — per restaurant (support, from the manual)

In order, once you have the #1 IP answer and a real CRN:

| # | Step | Where it lives in our system |
|---|------|------------------------------|
| 6 | Register in HNEH (u6 §5 + CSR + IP per #1) | SRC portal (external) |
| 7 | `keytool -genkeypair` → `.jks`; `keytool -certreq` → `.csr` (attach to u6) | Ops (external; runtime never touches `.jks`) |
| 8 | SRC approves: "Pending" → "Current" | SRC portal (external) |
| 9 | Download issued `.crt` + CA root `ca_645b34a4865e7.crt`, import to `.jks`, convert `.jks` → **PEM/PKCS12** | Ops (external). Our adapter consumes PEM only |
| 10 | **`activate`** → "Current" → "Operating" | ⚠️ **Not wired in our adapter** (see gap A) — do via SRC portal/tooling |
| 11 | **`configureDepartments`** with regimes from #4 | ⚠️ **Not wired in our adapter** (see gap B) — do via SRC portal/tooling; our dep→regime map only stamps line `dep`, it does not register departments on the device |
| 12 | Provision a cashier (`print` needs `cashierId`) | `FiscalConfig.cashierId` (support enters in the UI). See gap C |
| 13 | Load config into FISCAL-4 | Platform-admin fiscal-config UI: PEM cert/key (write-only upload) + CRN + cashierId + department map + Test connection |

### Code-relevant gaps to decide (honest flags)

- **Gap A — `activate` not implemented.** Our e-HDM adapter exposes `fiscalize`
  (print) + `checkConnection` only. Step #10 `activate` is done via SRC's HNEH
  system today. If we want one-click activation from the fiscal-config UI, that's a
  small adapter method + endpoint (a follow-up), not built.
- **Gap B — `configureDepartments` not implemented.** Same as above. Our
  `FiscalDepartment` map is READ by the adapter to fill each line's `dep`, but we do
  **not** call SRC's `configureDepartments` to register departments on the device —
  that's a manual/portal step (#11). Automating it is a follow-up.
- **Gap C — cashier for an automated channel.** `print` requires `cashierId`, but the
  QR/app channel has no human cashier. We store a `cashierId` per branch
  (`FiscalConfig.cashierId`), but **confirm with SRC** whether an automated channel
  needs a designated/virtual cashier and, if so, how to provision it. Feeds #12.

---

## D. Priority

1. **Now (launch gate, SRC phone calls):** #1 shared IP (decides topology — get it
   FIRST), #2 test access, #3 on-screen receipt.
2. **In parallel (accountant + data entry):** #4 tax regimes, **#5 ATG codes on every
   dish** (the big one — nothing fiscalizes without them).
3. **Per restaurant (once #1 + a real CRN):** #6–#13 onboarding.

**Bottom line:** the code is built and offline-verified. The three real blockers are
#1 (shared IP — a call to SRC), #2 (test access — a call to SRC), and #5 (ATG codes
— data entry). Two of the three are phone calls; the third is the accountant's
spreadsheet work. Everything else is either done or a small, clearly-scoped
follow-up (activate/configureDepartments automation).
