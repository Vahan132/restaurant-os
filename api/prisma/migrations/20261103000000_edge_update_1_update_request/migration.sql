-- EDGE-UPDATE-1: "Update now" request for a hub (delivered via the heartbeat reply).
ALTER TABLE "edge_nodes" ADD COLUMN "updateRequestedAt" TIMESTAMP(3);
