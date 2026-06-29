# Prompt 6D — Inventory Valuation + Stock Reports (Backend) — Handoff

Backend-only, on top of 6A–6C. The **read-side**: per-location and aggregate stock-on-hand, FIFO
valuation, low-stock and negative-stock lists, and a filterable movement history. **No writes, no
migration.** Orval and the frontend are out of scope.

## What changed (all read-only)

### New report endpoints — `GET /inventory/reports/*` (gated `inventory:read`, NOT @BranchScoped)
- `stock-on-hand` — per (item, location) quantity + FIFO value (paginated); response includes a
  `totalValuation_amount` roll-up over all matched rows. Filters: branchId, locationId, itemId,
  categoryId, lowStock.
- `valuation` — valuation roll-ups: `byLocation`, `byBranch`, and aggregate `totalValuation_amount`.
- `low-stock` — items at/below their (per-location else item-level) threshold.
- `negative-stock` — items currently negative at a location, with magnitude + value (correction
  worklist for 6A count adjustments).
- `movements` — the ledger filtered by item / location / branch / type / date range, combinable
  (AND). Extends the INV-1 `StockMovement` read path with the location/date filters rather than
  duplicating it; `StockMovementResponse` now carries `locationId`.

### Correctness (the §1 invariants)
- **Roll-up exactness** — every (item, location) row is valued independently and summed, so per-
  location values add up to the branch total and the branch totals to the aggregate, by construction.
- **FIFO valuation** = Σ over OPEN `StockLayer`s of `round(lineTotalCostAmount × remaining / received)`
  (HALF_UP) per (item, location). **Negative** on-hand is valued honestly at the item's last known
  unit cost (not floored at zero).
- **Transfers** never appear as COGS/consumption/revenue — 6D builds no COGS figure; valuation reads
  from layers where `TRANSFER_OUT`/`TRANSFER_IN` net to zero; the movement history is a raw ledger
  view where showing transfers is correct.
- **Imported sales (5A) are structurally excluded** — the reports only read the inventory projections
  (`StockOnHand` / `StockLayer` / `StockMovement`); imported sales live in separate tables that never
  touched stock.

### Branch isolation + Owner roll-ups
- Mirrors the audit activity-log pattern: the reports controller is **not** `@BranchScoped`. An
  `InventoryReportScopeService` resolves the caller's reach via `BRANCH_ACCESS_RESOLVER`
  (`resolveAccessibleBranches`). Owner (all-branch) callers get cross-branch roll-ups (or a single
  requested branch); branch-explicit callers are limited to the branches they hold a membership for;
  a requested branch outside reach returns **403** `BRANCH_ACCESS_FORBIDDEN`.
- Reads from the projections for performance; the ledger remains the source of truth.

## Run locally (sandbox can't — Prisma client/types regenerate there)
```bash
pnpm generate:openapi      # report endpoints appear; movements now carry locationId. (No migration.)
pnpm typecheck
pnpm lint
pnpm test
```
A focused type/DI/Prisma audit of the diff found no compile-breakers, but `tsc`/Prisma can't run
here — please run the above. **Stop after the spec regenerates** (no orval, no frontend).

## §5 verification checklist
- Stock-on-hand per (item, location) qty + FIFO value; per-location rolls up to branch totals —
  `PrismaInventoryReportReader.buildRows` + `stockOnHand`/`valuationSummary`.
- Valuation correct per location/branch/aggregate; matches pre-epic total for unchanged stock (all in
  Main Storage) — Σ OPEN layers per item is unchanged.
- Low-stock list at/below threshold per location; negative-stock list with location + magnitude.
- Movement history filters by item/location/branch/type/date, combinable — extended movement repo +
  `GetMovementHistoryUseCase`.
- Transfers excluded from COGS/consumption/revenue; imported sales excluded — by construction (above).
- Branch isolation enforced; cross-branch roll-ups gated to Owner — `InventoryReportScopeService`.
- OpenAPI regenerated, no path regressed — run `pnpm generate:openapi` locally to confirm.

---

With 6A–6D complete, the multi-location inventory epic's full backend is in place: foundation +
transfers + location-aware writes + reports. Handoffs: `INVENTORY_6A/6B/6C/6D_HANDOFF.md`.
