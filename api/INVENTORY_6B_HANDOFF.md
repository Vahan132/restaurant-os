# Prompt 6B — Within-Branch Inventory Transfers (Backend) — Handoff

Backend-only, on top of 6A. Moves stock between two `InventoryLocation`s of the **same branch**
with correct FIFO layer movement, at **carrying cost (no COGS)**. Receiving/consumption (6C),
cross-branch/in-transit transfers, orval, and the frontend are out of scope.

## What changed

### Schema + migration (`20260716000000_inventory_transfers`)
- New `InventoryTransfer` (header) + `InventoryTransferSlice` (consumed source lot → cost → qty,
  for audit). Reuses the 6A location-aware ledger (`StockMovement` `TRANSFER_OUT`/`TRANSFER_IN`,
  location-scoped `StockLayer`) — no parallel ledger. Additive/idempotent migration.

### Ledger gateway — `transfer()` (one transaction)
1. FIFO/FEFO-consume `Q` from the **source** location (`TRANSFER_OUT`), reusing the 6A core
   (`applyConsumptionTx` now also returns the per-slice `draws`). Decrements source on-hand +
   reconciles its low-stock alert.
2. **Over-transfer guard:** a shortfall (Q > source lots) throws `TRANSFER_EXCEEDS_ON_HAND` and
   rolls the whole transaction back — no negatives via transfer.
3. Group consumed slices by carrying unit cost (same cost merges, different costs stay separate —
   **no blending**), create one destination lot per group with `acquiredAt = transfer time` +
   a `TRANSFER_IN` movement, and record audit slices.
4. Raise destination on-hand; persist transfer header + slices. Source `-Q` / destination `+Q`
   net to zero per item, so **valuation is unchanged and no COGS/expense/revenue is realized**.
   `TRANSFER_*` are distinct ledger types, excluded from every consumption/COGS report by
   construction.

### Application / presentation
- `POST /inventory/transfers` (gated `inventory:transfer:create`, branch-scoped) — validates same
  branch (branch-scoped location lookups), A≠B, both `ACTIVE`, Q>0 (DTO), Q≤source on-hand.
- `GET /inventory/transfers` (paginated) and `GET /inventory/transfers/:id` (with moved-slice
  detail). New permission `inventory:transfer:create`.
- Transfers are audited via the new `INVENTORY_TRANSFERRED` action (`@OnEvent
  inventory.stock.transferred`).

### Deliberate simplification
Destination lots are created with `expiryDate = null` (the prompt's "new to the destination shelf
as of transfer time" / `acquiredAt = transfer time` semantics). Expiry is **not** carried across a
transfer in 6B — flag if you need FEFO continuity through transfers.

## Run locally (sandbox can't — Prisma client/types regenerate here)
```bash
pnpm prisma:migrate        # apply 20260716000000_inventory_transfers
pnpm generate:openapi      # regenerate openapi.json (NOT run here — do this last; no orval)
pnpm typecheck
pnpm lint
pnpm test
```
A focused type/DI/Prisma audit of the diff found no compile-breakers, but `tsc`/Prisma still can't
run in this environment, so please run the above. **Stop after the spec regenerates.**

## §6 verification checklist
- Cross-branch / inactive-location / A==B / Q≤0 / Q>source-on-hand all rejected — use-case
  validation + gateway rollback guard.
- Source consumed oldest-arrived-first; destination lots carry source cost, `acquiredAt = transfer
  time` — gateway `transfer()`.
- Mixed-cost transfer keeps separate destination cost layers (grouped by unit cost) — no blending.
- `TRANSFER_OUT` + `TRANSFER_IN` under one transfer id; slices recorded — `refType=TRANSFER`,
  `InventoryTransferSlice` rows.
- No COGS/expense/revenue; never appears as consumption/sale — distinct ledger types, net-zero
  valuation.
- Source + destination on-hand/lots updated atomically; partial failure rolls back — single
  `$transaction`.
- Low-stock alert fires if a transfer drops source below threshold — `touchOnHand` on the source draw.
- Transfer audited with full detail — `INVENTORY_TRANSFERRED`.
- OpenAPI regenerated, no path regressed — run `pnpm generate:openapi` locally to confirm.
