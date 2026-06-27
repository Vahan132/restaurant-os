-- OFF-3: downstream config sync bookkeeping on the edge-local EdgeSyncState.
--   lastConfigCursor   : ISO-timestamp cursor up to which cloud config is mirrored
--   lastConfigSyncedAt : when config last synced successfully
--   online             : live connectivity (set by the sync attempt itself)

ALTER TABLE "edge_sync_state" ADD COLUMN "lastConfigCursor" TEXT;
ALTER TABLE "edge_sync_state" ADD COLUMN "lastConfigSyncedAt" TIMESTAMP(3);
ALTER TABLE "edge_sync_state" ADD COLUMN "online" BOOLEAN NOT NULL DEFAULT false;
