-- OFF-8: hub heartbeat + telemetry.
--   - edge_nodes gains telemetry columns written by POST /edge-sync/heartbeat:
--     lastHeartbeatAt, pendingOutboxCount, appVersion, healthStatus.
--   - EdgeNodeHealthStatus enum: OK | SYNC_BACKLOG | SCHEMA_MISMATCH | OFFLINE.
--     OK/SYNC_BACKLOG/SCHEMA_MISMATCH are stored; OFFLINE is derived on read from
--     lastHeartbeatAt recency (a powered-off hub cannot report itself).
-- These columns are written only on the cloud (from edge heartbeats); on an edge
-- node they stay null (the edge has no rows of other nodes).

-- CreateEnum
CREATE TYPE "EdgeNodeHealthStatus" AS ENUM ('OK', 'SYNC_BACKLOG', 'SCHEMA_MISMATCH', 'OFFLINE');

-- AlterTable
ALTER TABLE "edge_nodes" ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3);
ALTER TABLE "edge_nodes" ADD COLUMN "pendingOutboxCount" INTEGER;
ALTER TABLE "edge_nodes" ADD COLUMN "appVersion" TEXT;
ALTER TABLE "edge_nodes" ADD COLUMN "healthStatus" "EdgeNodeHealthStatus";
