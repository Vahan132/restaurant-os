# Sales Import — CSV schema (5A)

Historical / external sales loaded here are **non-fiscal, reports-only**. They are
stored in their own tables (`imported_sales`, `imported_sales_batches`), never
enter the live order pipeline, never deplete inventory, and are **categorically
excluded from every fiscal/HDM total**. They surface only in the clearly-labeled
imported-sales analytics endpoints.

## Endpoint

`POST /sales-import` — `multipart/form-data`, field name **`file`** (a `.csv`).
Requires the `sales:import:manage` permission. Each row's branch is resolved and
must fall within the caller's permitted branch scope.

## Canonical columns

The first non-empty CSV line is the header row. Column matching is **tolerant**:
headers are normalized (trimmed, lowercased, punctuation/spaces collapsed to `_`)
then matched against an alias table, so `"Unit Price"`, `unit-price`, and
`UNIT_PRICE` all resolve to the same canonical column. Adding a new source format
later is a small change to the alias table in
`domain/value-objects/canonical-columns.ts` — never a rebuild.

| Canonical | Required | Maps to | Accepted header aliases (normalized) |
|-----------|----------|---------|--------------------------------------|
| `occurredAt` | ✅ | `occurredAt` (sale timestamp) | `date`, `datetime`, `occurred_at`, `timestamp`, `time`, `sold_at`, `sale_date`, `transaction_date` |
| `branch` | ✅ | resolved → `branchId` | `branch`, `branch_name`, `branch_id`, `location`, `store`, `outlet`, `site` |
| `item` | ✅ | `itemDescription` (+ optional `itemId`) | `item`, `item_name`, `item_description`, `description`, `product`, `product_name`, `menu_item`, `name` |
| `quantity` | ✅ | `quantity` | `quantity`, `qty`, `units`, `count` |
| `unitPrice` | ✅ | `unitPriceAmount` (minor units) | `unit_price`, `unitprice`, `price`, `price_each`, `unit_cost` |
| `lineTotal` | ✅ | `lineTotalAmount` (minor units) | `total`, `line_total`, `amount`, `total_price`, `line_amount`, `gross` |
| `paymentMethod` | — | `paymentMethod` | `payment_method`, `payment`, `payment_type`, `tender`, `tender_type` |
| `externalReference` | — | `externalReference` | `external_reference`, `reference`, `ref`, `external_id`, `transaction_id`, `transaction_ref`, `receipt_no`, `receipt_number`, `order_id` |

If any **required** column is missing after mapping, the whole file is
**structurally invalid** → batch status `FAILED`, nothing imported.

## Per-row validation rules

- **occurredAt** — parsed tolerantly. Accepted: ISO-8601 (`2026-03-01T13:45:00Z`),
  `YYYY-MM-DD`, `YYYY-MM-DD HH:mm[:ss]` (interpreted as UTC), and `MM/DD/YYYY`.
  Unparseable ⇒ row error.
- **branch** — resolved within the restaurant by **id** first, else by
  case-insensitive **name**. Unresolvable ⇒ row error. Resolving to a branch
  **outside the caller's permitted scope** ⇒ row error (isolation enforced).
- **item** — non-empty. Stored as `itemDescription`. `itemId` is linked only when
  a confident catalog match exists (left null otherwise).
- **quantity** — integer ≥ 1.
- **unitPrice / lineTotal** — money. Currency symbols and thousands separators are
  stripped; the value is parsed as a 2-decimal amount and stored in **minor units**
  (HALF_UP rounding). Must be ≥ 0.
- **line-total consistency** — `lineTotal` must equal `quantity × unitPrice` within
  a rounding tolerance of `quantity` minor units (absorbs per-unit rounding).
  Outside tolerance ⇒ row error (flagged, not silently recomputed).

## Idempotency

When `externalReference` is present, a `(restaurantId, externalReference)` pair is
imported **at most once**. Re-importing a row whose reference already exists (in the
database **or** earlier in the same file) is **skipped and reported** as a
duplicate — never inserted twice. Rows without a reference are never deduped.

## Outcome

Every upload returns a **per-row summary** (`row` number + `status` +
`message`) and records an `ImportBatch` with `rowCount` / `successCount` /
`errorCount` and a status:

- `COMPLETED` — every data row imported.
- `PARTIAL` — file was valid; some rows skipped (invalid or duplicate) — including
  the case where no rows were usable.
- `FAILED` — file structurally invalid (unparseable, empty, or missing required
  columns); nothing imported.
