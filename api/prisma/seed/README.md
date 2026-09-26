# SEED-1 — Full Restaurant Seed

One comprehensive, idempotent, deterministic seed that stands up a complete
working restaurant (Թավերն Արարատ — Tavern Ararat) end to end: org → restaurant →
two branches → IAM → devices → catalog → multi-location inventory → recipes →
KDS processes → reservations → ~1 business day of orders that deplete stock
through the real ledger.

## Run

```bash
pnpm docker:up        # Postgres (+ Redis); required
pnpm prisma:deploy    # or prisma migrate dev — schema must be applied
pnpm db:seed          # ts-node --transpile-only prisma/seed.ts → prisma/seed/index.ts
```

Env required (the config module validates fail-fast): `DATABASE_URL`,
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PLATFORM_JWT_ACCESS_SECRET`,
`PLATFORM_JWT_REFRESH_SECRET`. Leave `APP_MODE` at the default **CLOUD** — EDGE
never mints a per-restaurant signing key, which staff-PIN fingerprints need.

A second `pnpm db:seed` reproduces identical counts, ids (for config) and
inventory valuation — it resets seed-owned rows first, then reseeds.

## Architecture (two-mechanism rule)

- **Inert config** (org, restaurant, branches, roles + grants, staff users,
  memberships, categories, modifier groups, dishes + attachments/overrides,
  inventory item master, recipes/BOM, floors/tables, reservations) → direct
  **Prisma upsert by deterministic id** (`seedId(slug)` = uuidv5).
- **Invariant-bearing writes** → the **real use-cases**, resolved from a booted
  Nest application context:
  - opening balances → `CreateGoodsReceiptUseCase` (StockLayer + RECEIPT_IN
    movement + ledger on-hand + lastUnitCostMicro, atomic),
  - processes → `CreateProcessUseCase` + one `RunProcessUseCase` (PROCESS_OUT
    inputs / PROCESS_IN outputs, rolled-up cost),
  - orders → `CreateOrder → AddOrderItem → SendToKitchen → MarkServed →
    RecordPayment → CloseOrder` (BOM depletion fires on send-to-kitchen via the
    inventory listener), plus a cancelled order (consumption reversal).
  - per-restaurant signing key → `RestaurantKeyProvider.getSigningKey`,
    staff PINs → `CreateStaffPinUseCase`, devices → `EnrollDeviceUseCase`.

Files: `ids.ts`, `context.ts`, `reset.ts`, `state.ts`, `index.ts`,
`data/*` (editable menu / inventory / iam / core), `modules/01..11`.

## §1 inspection findings (build-against-reality notes)

- **Localization**: the schema has **no i18n/translation column** anywhere —
  one `name`/`description` string per row. Adding one = a schema change (a hard
  stop), so each dish carries **hy / ru / en in `data/menu.ts`** (source of
  truth) and the **hy** primary persists to `MenuItem.name`/`.description`
  (`restaurant.defaultLanguage = 'hy'`). ru/en remain in the seed source.
- **Opening movements**: `StockMovementType.OPENING` exists in the schema but is
  written by **no use-case/gateway** (dead/reserved). The real opening-balance
  path is the goods-receipt use-case → **RECEIPT_IN** movements. The seed uses
  it; verify opening lots as RECEIPT_IN, not OPENING.
- **System locations**: branch creation does **not** auto-provision inventory
  locations. `InventoryLocationProvisioner.ensureSeeded` does (Main Storage
  [default] / Kitchen / Bar + WARN policy); the seed calls it per branch and
  reuses those rows.
- **Role codes**: the real system roles are `OWNER, MANAGER, WAITER, CASHIER,
  KITCHEN_STAFF, CHEF, SOUS_CHEF, RECEPTIONIST, BRANCH_SCOPED` (sentinel). The
  prompt's "Kitchen" = `KITCHEN_STAFF`. Capabilities granted by KEY from
  `permissions.catalog`. OWNER carries `allBranches`.
- **Depletion is event-driven**: no order use-case calls stock consumption
  directly; `SendToKitchen` publishes `orders.order.items_sent_to_kitchen`, the
  inventory `OrderConsumptionListener` consumes recipes FIFO (warn-don't-block).
  The seed boots the **full AppModule** so the listener + event bus are present.
- **Determinism caveat**: rows created through use-cases (receipts, layers,
  movements, orders, payments, staff PINs, devices, process runs, and the audit
  rows their events trigger) get **cuid** ids from the app — by design. Their ids
  differ run-to-run; idempotency for them is wipe-then-reseed → identical COUNTS
  and identical VALUATION. All Prisma-written config rows keep stable uuids.
- **Boot**: CLOUD imports RedisModule; ioredis connects async with background
  retries and the seed issues no Redis commands, so it doesn't block context
  boot — but run `docker:up` so Redis is reachable (avoids noisy retry logs).

## Verification checklist (§4) — what to confirm after running

1. **Fresh DB**: seed runs green from empty.
2. **Idempotency**: second run → identical entity counts + identical inventory
   valuation, no duplicate-key errors. (Config ids identical; use-case-row ids
   differ by design — see caveat above.)
3. **Ledger-as-truth**: for every (item, location), on-hand = opening − consumed,
   non-negative; replaying StockMovement reproduces StockOnHand + StockLayer.
4. **Auth**: a seeded staff member PIN-logs-in on a seeded device of their branch
   (use the printed device secret + minted PIN); capability checks resolve by key.
5. **Catalog**: hy persisted (ru/en in `data/menu.ts`); modifier attachments +
   overrides resolve; prices in AMD.
6. **Processes**: the seeded run shows PROCESS_OUT (input depletion) + PROCESS_IN
   (output accrual) in the ledger.
7. **No schema change**; orval not run; frontends untouched.

The seed prints entity counts, stock-movement counts by type, and inventory
valuation (received vs on-hand) at the end.

## SEED-2 — operating history for reports (phase 15)

`modules/15-history.ts` + `history-clock.ts` add a multi-day history so every
report (Products, Profit, Summary, Payment methods, Waiters, Tables, Discounts,
Cancellations, Imported sales, End-of-day inventory, Write-offs, Expenses) has
data across a date range.

- **Window**: the `SEED_HISTORY_DAYS` business days before today (default **45**;
  `SEED_HISTORY_DAYS=0` disables the phase and restores SEED-1 behaviour).
  Today stays covered by phase 11. Opening balances (phase 07) are now received
  at 08:00 on the day before the window, so the ledger is chronological.
- **Per day, per branch** (real use-cases): top-up goods receipts from 3 seeded
  suppliers (items below 60% of par; unit cost drifts ±8% → FIFO cost history),
  flagship production runs (marinade daily, tomato sauce every other day),
  8–25 orders (Fri/Sat busier) 11:00–23:00 on random tables / takeaway with
  random modifiers, 3–4 waiters, cash / card / bank transfer / other / split
  payments, ~13% discounted (percent + fixed), ~10% with a voided line, ~4%
  cancelled orders; write-offs (spoilage, staff meal dish, breakage, expired
  marinade); expenses in 5 categories (utilities on the 1st, supplies weekly…).
- **Backdating**: order use-cases stamp "now", so each finished order is moved
  onto its day (order createdAt/closedAt, items, payments, ORDER_LINE movements
  + reversals). Cost-change rows are moved to the day's end. Frozen
  `inventory_daily_reports` are deleted at the end so every day rebuilds from the
  final ledger.
- **Imported sales**: one COMPLETED batch covering the 14 days before the window.
- Deterministic PRNG → same history on every run (relative to today). Expect a
  few minutes of runtime for the default 45 days.
