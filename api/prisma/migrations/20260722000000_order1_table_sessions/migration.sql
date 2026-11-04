-- ORDER-1: TableSession ordering container + per-branch OrderingConfig +
-- non-breaking Order.tableSessionId seam. Fully ADDITIVE and safe on existing
-- data (new columns carry defaults; the new table/FK are empty at first).

-- ── Enums ─────────────────────────────────────────────────────────────────────
CREATE TYPE "TableSessionState" AS ENUM ('PENDING_CONFIRM', 'OPEN', 'LOCKED', 'CLOSED', 'EXPIRED');
CREATE TYPE "TableSessionFlow" AS ENUM ('PREPAYMENT', 'PAY_AT_END');
CREATE TYPE "TableSessionChannel" AS ENUM ('QR_WEB', 'APP');

-- ── Branch ordering config (flat columns, safe defaults) ──────────────────────
ALTER TABLE "branches" ADD COLUMN "orderingPrepaymentEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN "orderingPayAtEndEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN "orderingQrEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN "orderingIdleExpiryMinutes" INTEGER NOT NULL DEFAULT 150;

-- ── TableSession ──────────────────────────────────────────────────────────────
CREATE TABLE "table_sessions" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "state" "TableSessionState" NOT NULL,
    "flow" "TableSessionFlow" NOT NULL,
    "channel" "TableSessionChannel" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "consumerAccountId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "table_sessions_branchId_tableId_idx" ON "table_sessions"("branchId", "tableId");
CREATE INDEX "table_sessions_restaurantId_idx" ON "table_sessions"("restaurantId");
CREATE INDEX "table_sessions_restaurantId_branchId_idx" ON "table_sessions"("restaurantId", "branchId");
CREATE INDEX "table_sessions_tableId_idx" ON "table_sessions"("tableId");
CREATE INDEX "table_sessions_state_idx" ON "table_sessions"("state");
CREATE INDEX "table_sessions_lastActivityAt_idx" ON "table_sessions"("lastActivityAt");

-- Partial UNIQUE index: AT MOST ONE non-terminal session per (branch, table).
-- Prisma cannot express filtered indexes, so it lives here in raw SQL. Preserve
-- it on future migrations (a plain @@index([branchId, tableId]) is declared in
-- the schema to keep Prisma in sync).
CREATE UNIQUE INDEX "table_sessions_active_unique"
    ON "table_sessions"("branchId", "tableId")
    WHERE "state" IN ('PENDING_CONFIRM', 'OPEN', 'LOCKED');

-- ── Order.tableSessionId seam (nullable FK; SetNull) ──────────────────────────
ALTER TABLE "orders" ADD COLUMN "tableSessionId" TEXT;

CREATE INDEX "orders_tableSessionId_idx" ON "orders"("tableSessionId");

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_tableSessionId_fkey"
    FOREIGN KEY ("tableSessionId") REFERENCES "table_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
