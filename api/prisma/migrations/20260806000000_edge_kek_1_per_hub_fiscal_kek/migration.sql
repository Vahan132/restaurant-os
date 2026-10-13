-- EDGE-KEK-1: per-hub fiscal KEK on the edge node (envelope-wrapped under the
-- cloud master KEK). Additive, nullable, safe on existing rows. No backfill: an
-- existing node keeps a null KEK and continues on the shared-KEK passthrough
-- (its fiscal DEKs are emitted master-wrapped) until it is (re-)paired
-- (EDGE-PAIR-2), which populates these columns and delivers the bare KEK to the
-- hub. Once set, the cloud re-wraps each synced fiscal row's DEK to this KEK so a
-- stolen hub only exposes its own branch's fiscal secrets. The master KEK never
-- leaves the cloud, and the bare per-hub KEK is never stored here (only wrapped).
ALTER TABLE "edge_nodes" ADD COLUMN "fiscalKekCipher" BYTEA;
ALTER TABLE "edge_nodes" ADD COLUMN "fiscalKekIv" BYTEA;
ALTER TABLE "edge_nodes" ADD COLUMN "fiscalKekAuthTag" BYTEA;
