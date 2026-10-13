-- OFF-2: edge provisioning + snapshot bootstrap.
--   - edge_nodes: cloud-side registry of provisioned on-prem hubs.
--   - edge_sync_state: edge-local bookkeeping (one row per node).
--   - backfill the new EDGE_MANAGE permission onto existing OWNER/MANAGER roles
--     (system-role permission sets are only written at provisioning, so existing
--     roles need an explicit backfill).

-- CreateEnum
CREATE TYPE "EdgeNodeStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "edge_nodes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "EdgeNodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSeenAt" TIMESTAMP(3),
    "lastSnapshotAt" TIMESTAMP(3),
    "schemaVersion" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edge_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edge_sync_state" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "snapshotVersion" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edge_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "edge_nodes_tokenHash_key" ON "edge_nodes"("tokenHash");

-- CreateIndex
CREATE INDEX "edge_nodes_restaurantId_branchId_idx" ON "edge_nodes"("restaurantId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "edge_sync_state_nodeId_key" ON "edge_sync_state"("nodeId");

-- Backfill EDGE_MANAGE onto existing restaurant-wide admin roles.
UPDATE "roles"
SET "permissions" = array_append("permissions", 'EDGE_MANAGE')
WHERE "code" IN ('OWNER', 'MANAGER')
  AND NOT ('EDGE_MANAGE' = ANY("permissions"));
