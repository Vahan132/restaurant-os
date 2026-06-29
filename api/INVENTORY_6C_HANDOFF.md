# Prompt 6C — Location-Aware Inventory Writes + Edge — Handoff

Backend-only, on top of 6A + 6B. Makes the existing **receiving** and **serve-time consumption**
write paths location-aware, enforces the negative-stock policy with the **never-block-a-sale**
exception, and keeps it correct **offline at the edge**. Reports (6D), orval, and the frontend are
out of scope.

## What changed

### Per-item consumption location (schema + resolver)
- `InventoryItem.consumptionLocationId` (nullable) — where an item is depleted on serve, per item
  per branch. Migration `20260717000000_inventory_consumption_location` backfills existing items to
  their branch Main Storage. Null falls back to Main Storage via the resolver.
- The **single resolver helper** (`InventoryLocationProvisioner`) gained
  `resolveConsumptionLocationId` (per-item override else Main Storage) and `resolveReceivingLocationId`
  (validated requested location else Main Storage) — replacing the 6A "always Main Storage" stopgap.
- Reassign endpoint: `PATCH /inventory/items/:id/consumption-location` (omit/null resets to default).
  `consumptionLocationId` is now on the item read model.

### Receiving → location-aware (+ negative backfill)
- `POST /inventory/goods-receipts` accepts an optional target `locationId` (default Main Storage,
  validated active + in-branch). Received lots land there.
- **Backfill rule** (gateway `recordReceipt`): if the target has negative on-hand for the item, the
  receipt **cancels the negative first** — only the remainder becomes positive layer stock (a fully
  absorbed layer is created DEPLETED). The `RECEIPT_IN` movement still records the full quantity, so
  the ledger reconciles (Σ movements == on-hand).

### Consumption-on-serve → location-aware (never blocks)
- `InventoryConsumptionService.consume()` — the single depletion choke point — now resolves the
  item's consumption location and passes it to `ledger.consume`, which draws that location's FIFO and
  writes a **location-scoped CONSUMPTION** movement per ingredient. On shortfall it goes **negative**
  (costed at last known unit cost) and **never throws** — a sale is never blocked on inventory.
- Low-stock alerts (6A) fire when serve-time depletion crosses an (item, location) threshold.
- `negativeStockMode` BLOCK/WARN governs **manual** stock-out only (manual `ADJUSTMENT_OUT` now
  BLOCK-checks the consumption location); serve is exempt. This also covers write-offs, which now
  deplete the item's consumption location (process-run inputs are unchanged — they still draw across
  the item's lots).

### Edge / offline
- Config-down snapshot extended (contract + builder + applier) with `InventoryLocation`,
  `BranchInventoryPolicy`, and the `StockOnHand` projection; each item's `consumptionLocationId`
  rides the existing `inventoryItems` sync. The edge runs the same location-aware consume offline,
  resolving the correct location and depleting its FIFO.
- Offline serves reconcile **up** via the existing append-only outbox (`STOCK_MOVEMENT` +
  `STOCK_LAYER` — no new channel). The cloud operational-writer now **rebuilds `StockOnHand`** for
  each touched (item, location) from the converged ledger after applying a push, so cloud on-hand
  stays correct. Never-block holds offline (same code path).

## Run locally (sandbox can't — Prisma client/types regenerate there)
```bash
pnpm prisma:migrate        # apply 20260717000000_inventory_consumption_location
pnpm generate:openapi      # receiving now takes a location; consumption-location endpoint appears
pnpm typecheck
pnpm lint
pnpm test
```
A focused type/DI/Prisma audit of the diff found no compile-breakers, but `tsc`/Prisma can't run
here — please run the above. **Stop after the spec regenerates** (no orval, no reports, no frontend).

## §7 verification checklist
- Each item has a default consumption location (per branch), seeded to Main Storage; reassignable —
  `consumptionLocationId` + migration backfill + `PATCH .../consumption-location`.
- Receiving accepts a target location (default Main Storage); stock lands there — receipt DTO/usecase.
- Receipt to a negative location backfills first, then adds positive layers — `recordReceipt`.
- Serving depletes each ingredient from its resolved consumption location FIFO via location-scoped
  CONSUMPTION movements — consumption service + gateway `applyConsumptionTx(locationId)`.
- Insufficient stock still succeeds, goes negative, costs shortfall at last known unit cost — consume
  never throws; shortfall attributed to the consumption location.
- `negativeStockMode` governs manual flows but NOT serve — BLOCK enforced only in manual adjustment.
- Low-stock alerts fire on serve-time depletion crossing thresholds — `touchOnHand`.
- Edge snapshot extended (locations, per-item default location, policy, on-hand); offline serve
  depletes the correct location + reconciles via outbox; never-block holds — snapshot + applier +
  operational-writer reconcile.
- All movements + projections updated atomically — single `$transaction` per write.
- OpenAPI regenerated, no path regressed — run `pnpm generate:openapi` locally to confirm.
