-- OFF-4: upstream operational sync (edge→cloud).
--   - outbox_entries: append-only, gapless per-node stream of operational writes.
--   - edge_outbox_counter: singleton gapless sequence source.
--   - edge_sync_state: push bookkeeping (lastPushedSeq + lastPushAt).
-- These tables are written only on EDGE nodes; on the cloud they stay empty.

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SYNCED');

-- CreateTable
CREATE TABLE "outbox_entries" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "edgeSeq" INTEGER NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edge_outbox_counter" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "edge_outbox_counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_entries_edgeSeq_key" ON "outbox_entries"("edgeSeq");

-- CreateIndex
CREATE INDEX "outbox_entries_status_edgeSeq_idx" ON "outbox_entries"("status", "edgeSeq");

-- AlterTable
ALTER TABLE "edge_sync_state" ADD COLUMN "lastPushedSeq" INTEGER;
ALTER TABLE "edge_sync_state" ADD COLUMN "lastPushAt" TIMESTAMP(3);
