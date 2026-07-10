# ORDER-2 — QR-Web Prepayment Ordering (Backend) — Handoff

First live ordering flow: an anonymous QR-web customer builds a cart, prepays (stubbed gateway), the paid order is fiscalized (stubbed e-HDM), dispatched to KDS via the existing realtime path, and attached to a `PREPAYMENT` `TableSession`. A digital fiscal receipt (`qr` string) is returned for display.

Built additively on ORDER-1. **This code was written without a local compile/migrate loop (the toolchain + DB are Windows-only), so run the steps in "Close the loop" before relying on it.**

## Close the loop (run on Windows, in `api/`)

```powershell
# 1) Generate the migration from the additive schema diff + apply it
pnpm prisma migrate dev --name order2_qr_prepayment

# 2) Regenerate the Prisma client (new Order/OrderItem/Payment fields)
pnpm prisma generate

# 3) Typecheck / build + tests
pnpm build          # or: pnpm tsc --noEmit
pnpm test
pnpm start:dev      # smoke-test the endpoints below
```

**Migration review — two things to verify in the generated SQL:**
- It must **preserve the partial unique index** on `table_sessions` (`UNIQUE(branchId,tableId) WHERE state IN ('PENDING_CONFIRM','OPEN','LOCKED')`). It was created via raw SQL and is not in the schema; if the diff tries to drop it, keep it (re-add the raw `CREATE UNIQUE INDEX ... WHERE ...` in the migration).
- All changes are additive + safe on existing rows: new nullable/defaulted columns on `orders`/`order_items`; `orders.waiterId` and `payments.processedByUserId` relaxed to nullable (DROP NOT NULL).

## API surface (all `@Public()`, host/slug-resolved, session-token-scoped, throttled per-IP)

The QR endpoints require the ORDER-1 opaque session token (from `POST /public/table-sessions/open`) in the **`X-Session-Token`** header. The `SessionTokenGuard` resolves it to the active session and scopes every read/write to that session's branch + table.

- `POST /public/qr/orders/validate-cart` — recompute cart pricing server-side (30/min).
- `POST /public/qr/orders` — create the prepayment order (DRAFT/UNPAID) from the validated cart (10/min).
- `POST /public/qr/orders/:orderId/confirm-payment` — charge → fiscalize → dispatch; **idempotent** (10/min).
- `GET  /public/qr/orders/:orderId/receipt` — fiscal receipt incl. `qr` (60/min; `fiscalized:false` while pending).

## Files

**New**
- `src/shared/domain/value-objects/money.ts`, `quantity.ts` — shared VOs (Int minor units / Int thousandths, half-up, no float).
- `src/shared/storefront/session-context.ts` — `SessionContext` + `@CurrentSession()`.
- `src/modules/payment/` — `PaymentPort` + `StubPaymentAdapter` + `PaymentModule` (mirrors fiscalization).
- `src/modules/table-sessions/presentation/http/session-token.guard.ts` — token read-path guard.
- `src/modules/table-sessions/application/commands/touch-table-session.usecase.ts`.
- `src/modules/orders/application/commands/{validate-cart,create-prepayment-order,confirm-payment}.usecase.ts`.
- `src/modules/orders/application/queries/get-order-receipt.usecase.ts`.
- `src/modules/orders/application/services/{cart-pricing,fiscalize-order}.service.ts`.
- `src/modules/orders/application/dto/{qr-cart.types,qr-order.dto,qr-order.responses}.ts`.
- `src/modules/orders/presentation/http/public-qr-orders.controller.ts`.

**Changed**
- `prisma/schema.prisma` — `Order` (+tender split, +fiscal result, +partnerTin/paymentReference, waiterId nullable), `OrderItem` (+goodCode/goodName/unit + reserved fiscal fields), `Payment` (processedByUserId nullable).
- `orders/domain/entities/order.ts` — lifted `tableSessionId`; nullable waiter; fiscal/tender props + getters; `settlePrepaymentCard`, `applyFiscalResult`, `dispatchPrepaid`, `hasBeenDispatched`, `isFiscalized`.
- `orders/domain/entities/order-item.ts` — fiscal-ready line fields + getters.
- `orders/domain/entities/payment.ts` — nullable `processedByUserId`.
- `orders/domain/orders.errors.ts` — `OrderAlreadyPaidError`, `PrepaymentNotSettledError`.
- `orders/infrastructure/persistence/order.mapper.ts` — map all new fields.
- `orders/application/application.errors.ts` — `CartEmpty`, `PaymentDeclined`.
- `orders/application/ports/menu-reader.port.ts` + `infrastructure/readers/prisma-menu.reader.ts` — expose `code`.
- `orders/application/services/order-item-builder.ts` — snapshot `goodCode`/`goodName`.
- `orders/orders.module.ts` — import TableSessions/Fiscalization/Payment/Throttler; register QR controller + use-cases.
- `fiscalization/.../fiscalization.port.ts` + stub — extended input (mode/channel/partnerTin/tender split) + result (`fiscalNumber`/`qr`/`sn`/`time`/`total`/`change`).
- `table-sessions/domain/repositories/table-session.repository.ts` + prisma impl — `findByTokenHash`.
- `table-sessions/table-sessions.module.ts` — export OpenOrJoin/Touch use-cases + `TABLE_SESSION_REPOSITORY` + `SESSION_TOKEN_SERVICE` tokens. `SessionTokenGuard` is *provided* in OrdersModule (a controller's guard is instantiated in the controller's module context) with its deps resolved via those exported tokens.
- Nullability ripple fixes: `orders/application/dto/responses.ts`, `orders/application/ports/receipt-reader.port.ts` + reader, `kds/.../prisma-station-tickets.reader.ts`, `reports/.../prisma-reports-query.service.ts`.

## Key design decisions (some deviate from the literal spec — flagged intentionally)

- **Money stays Int minor units; no `Decimal`.** The `Money` VO wraps integer minor units and is the shared enforcement type at the new QR/fiscal boundary. The pre-existing order-total math (`orders/domain/money.ts`) already does integer half-up with no floats, so it was **not** rewritten through the VO — that would be non-additive churn with identical semantics.
- **Quantity column NOT reinterpreted.** `OrderItem.quantity` remains an integer whole-unit COUNT (shared with POS/KDS/inventory). The `Quantity` VO (Int thousandths, 3dp, half-up) is the enforcement point used at the fiscal boundary (`fromUnits(n)` → n×1000). Reinterpreting the existing column as thousandths would break POS and violate migration-safety. Fractional quantities become relevant when weighed-goods lands.
- **No new `OrderStatus`.** Prepaid = `paymentStatus=PAID` gating the existing `DRAFT → SENT_TO_KITCHEN` transition, via `dispatchPrepaid()` (reuses `sendToKitchen` → `OrderItemsSentToKitchenEvent` → realtime relay → KDS). `channel`/`flow` are derived from the session, not stored on Order.
- **Idempotency & recoverability.** `ConfirmPayment` is two-phase: (A) charge (gateway keyed on order id) + settle under the order row lock, skipped if already PAID; (B) fiscalize (external call outside the tx) then persist-fiscal + dispatch in one tx. A fiscalization failure leaves the order **PAID but unfiscalized** (recoverable) and **never dispatched unfiscalized**; a retried confirm re-runs Phase B only. `applyFiscalResult` and the dispatch guard are idempotent.
- **Fiscalization is a per-transition hook** (`FiscalizeOrderService.fiscalizeProducts`, `mode` is a parameter). `// NOTE` marks the pending accountant decision (single mode-2 products receipt vs. mode-3 prepayment + mode-2 fulfillment) — switching is additive.

## Step 5 invariants — status

All hold in code (verify once compiled/tested):
- [x] Server recomputes all prices/totals (`CartPricingService` via `OrderItemBuilder`); client amounts never trusted.
- [x] `Money`/`Quantity` VOs enforce grain + half-up; no float, no Decimal.
- [x] `SENT_TO_KITCHEN` only when `paymentStatus=PAID` (`dispatchPrepaid` gate); no new `OrderStatus`.
- [x] `channel`/`flow` derived from session; `waiterId` nullable; no sentinel user.
- [x] Session-token read-path (`findByTokenHash` + `SessionTokenGuard`) scopes every QR read/write.
- [x] Fiscalization fires once per paid order, idempotently; failure → recoverable paid-but-unfiscalized + retry; never silently dispatched unfiscalized.
- [x] `ConfirmPayment` idempotent on the order (charge keyed by order id; PAID short-circuit under row lock).
- [x] Append = new order; a PAID order is never mutated by the flow.
- [x] `goodName`/`unitPrice` snapshotted at order time.
- [x] Reserved fiscal fields present + nullable, no logic.
- [x] Fiscalization trigger is a per-transition hook.
- [x] Writes via use-cases; runtime ids via cuid `IdGenerator`.

## Step 6 — after green
1. Regenerate OpenAPI: `pnpm start` then export, or the repo's spec task → `openapi.json`.
2. `orval` codegen in the QR-menu app (and admin if it reads orders); confirm hooks compile.
3. Next: ORDER-2-FE (menu → cart → pay → receipt/status) — separate prompt.
