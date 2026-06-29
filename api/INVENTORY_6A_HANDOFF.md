# Prompt 6A — Multi-Location Inventory (Backend Foundation) — Handoff

Backend-only. Foundation for the multi-location inventory epic: stock locations,
a location-aware ledger as source of truth, per-(item, location) FIFO lots + on-hand,
the configurable negative-stock policy (alerts + correction adjustments), and a safe
migration of existing stock. Transfers (6B), location-aware receiving/consumption/valuation
(6C), and edge sync (later) are intentionally **not** built here.

---

## §1 — Inspection findings (NOTE, before building)

- **Units.** Each `InventoryItem` already carries a single `baseUnit` (`GRAM | MILLILITER |
  PIECE`). Alternate units are stored as JSON `{ name, factor }` with an **integer factor to
  the base unit** (`alternate-unit.ts` / `item.toBaseQty`). There is **no separate
  purchase/receiving unit**: goods receipts accept `unit` + `qty` and convert to base via the
  same alternate-factor mechanism. **Conclusion: all ledger / lot / on-hand quantities are
  integers in the item's single base unit; no purchase-unit conversion is needed** (the
  alternate-factor path already covers "receive kg, stock grams").
- **Existing stock model.** Stock is **not** single-location lots — it was restaurant+branch+item
  scoped. `StockLayer` = FIFO/FEFO lots (`baseQtyRemaining`, `lineTotalCostAmount`, `receivedAt`,
  `status OPEN|DEPLETED`); `StockMovement` = the **append-only ledger / source of truth**
  (`type`, signed `baseQty`, `costAmount`, `refType/refId`, `reversedAt`). On-hand was derived by
  summing movements. `InventoryItem` already had `lowStockThresholdBase` and `lastUnitCostMicro`.
  → 6A adds a `locationId` dimension to these existing structures (see decisions below).
- **Recipe/BOM depletion confirmed.** `Recipe` (BOM per menu item) + `RecipeConsumptionService`
  + the event-driven `OrderConsumptionListener` already explode a dish → ingredient consumption.
  6C will make that depletion location-aware; this prompt does not touch it.

## Architecture decisions (confirmed with you)

1. **Extend, don't duplicate.** 6A's `InventoryLedgerEntry`/`StockLot` map onto the existing
   `StockMovement`/`StockLayer`. We added `locationId` to both and added `OPENING`,
   `TRANSFER_OUT`, `TRANSFER_IN` to the existing `StockMovementType` (RECEIPT/CONSUMPTION/
   ADJUSTMENT already exist under the established `*_IN/*_OUT` naming). New tables:
   `InventoryLocation`, `StockOnHand`, `BranchInventoryPolicy`, `LowStockAlert`.
2. **Existing writes default to Main Storage.** Goods-receipt, manual adjustment-IN, and
   process-run outputs now resolve the branch's **default (Main Storage)** location. The reusable
   `StockConsumptionPort.consume` signature is unchanged — OUT movements take their location from
   the drawn lot, and any shortfall lands on Main Storage. INV-1..4 behavior is preserved.
3. **No duplicate OPENING entries on migration (intentional deviation).** The checklist says
   "write OPENING entries representing migrated balances." In *this* codebase the `StockMovement`
   ledger **already exists and already reconciles to on-hand**. Writing OPENING entries equal to
   current balances would **double-count valuation**. Instead the migration relocates the existing
   lots + ledger into Main Storage and **builds `StockOnHand` by summing the existing ledger** —
   which fully satisfies "ledger is the source of truth" and "projections rebuildable from the
   ledger" without corruption. `OPENING` remains a defined, supported type for seeding genuinely
   new (item, location) balances going forward. **Flagging this for your review.**

---

## What changed

### Schema (`prisma/schema.prisma`)
- Enums: `InventoryLocationType`, `InventoryLocationStatus`, `NegativeStockMode`,
  `LowStockAlertStatus`; `StockMovementType` += `OPENING | TRANSFER_OUT | TRANSFER_IN`.
- `StockLayer` + `StockMovement`: new required `locationId` (+ location-scan indexes).
- New models: `InventoryLocation`, `StockOnHand`, `BranchInventoryPolicy`, `LowStockAlert`.

### Migration (`prisma/migrations/20260715000000_inventory_locations/`)
Idempotent: creates enums/tables/indexes; seeds **Main Storage (default) / Kitchen / Bar** per
existing branch (deterministic ids); backfills `locationId → Main Storage` on existing lots +
ledger then `SET NOT NULL`; builds `StockOnHand` from the existing ledger; seeds
`BranchInventoryPolicy = WARN` per branch.

### Ledger gateway (`prisma-inventory-ledger.gateway.ts`) — the core change
Every append now **maintains `StockOnHand` + reconciles low-stock alerts in the same transaction**
(`touchOnHand`). The FIFO core (`applyConsumptionTx`) tags each OUT movement with its lot's
location, attributes shortfalls to Main Storage, and accepts an optional `locationId` to scope a
draw. New `setCountedOnHand()` implements the correction adjustment atomically.

### Application / presentation
- Location CRUD (`/inventory/locations`, system-undeletable, custom empty-only delete) +
  per-location on-hand (`GET /inventory/locations/:id/on-hand`).
- Correction adjustment `POST /inventory/adjustments/count` (set actual counted on-hand → signed
  ADJUSTMENT, valued at last known unit cost, audited via `INVENTORY_COUNT_ADJUSTED`).
- Branch policy `GET/PUT /inventory/policy`; low-stock alerts `GET /inventory/alerts/low-stock`.
- `NegativeStockPolicyService` enforces **BLOCK** on manual/admin depletions (POS-serve exception
  is 6C); `InventoryLocationProvisioner` lazily seeds any branch on first touch.
- New permissions: `inventory:location:manage`, `inventory:policy:manage`.

---

## You must run these locally (the Cowork Linux sandbox can't — see toolchain notes)

```bash
pnpm prisma:migrate        # apply 20260715000000_inventory_locations
pnpm generate:openapi      # regenerate openapi.json (DO NOT run orval / touch frontend)
pnpm typecheck
pnpm lint
pnpm test                  # existing suite — note: 3 use-case constructors gained deps
```

`generate:openapi` could not be run here (in-sandbox node codegen would emit a corrupt spec per
the known stale-mount gotcha), so `openapi.json` is **not** regenerated in this change — please
regenerate it locally as the final step. **Stop after the spec regenerates** (no orval, no
transfers/receiving/consumption, no frontend).

## §9 verification checklist → where it's satisfied

- Inspection NOTE — this doc + migration header.
- 3 system locations/branch + custom CRUD (empty-only delete, undeletable system) — migration seed
  + `manage-location.usecase.ts` + `InventoryLocationProvisioner`.
- Append-only ledger; same-transaction lot + on-hand updates; rebuildable — gateway `touchOnHand`;
  `StockOnHand` = Σ ledger by (item, location).
- Existing stock migrated to Main Storage, unchanged valuation + FIFO order — migration relocates
  `locationId` only (no cost/order change); no double-count OPENING (see decision 3).
- Negative on-hand + last-known-cost shortfall + next-RECEIPT-backfills-first (RECEIPT in 6C) —
  preserved FIFO planner; `StockOnHand.quantity` may be negative.
- `negativeStockMode` ALLOW/WARN/BLOCK + pre-zero low-stock alert — `BranchInventoryPolicy`,
  `NegativeStockPolicyService`, `LowStockAlert` raised at/below threshold while ≥ 0.
- Correction adjustment sets actual on-hand, signed ADJUSTMENT, atomic, audited — `setCountedOnHand`
  + `SetCountedOnHandUseCase` + `INVENTORY_COUNT_ADJUSTED`.
- All quantities in base unit; conversion respected only where present — unchanged base-unit model.
- OpenAPI regenerated, no path regressed — run `pnpm generate:openapi` locally to confirm.
