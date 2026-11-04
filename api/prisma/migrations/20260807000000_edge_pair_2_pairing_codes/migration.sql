-- EDGE-PAIR-2: single-use, short-TTL, branch-scoped pairing codes. Additive: a new
-- table only; no change to existing rows. Only sha256(code) is stored (codeHash),
-- never the plaintext. A code is redeemed atomically (consumedAt) and expires at
-- expiresAt. Redeeming creates the EdgeNode + its per-hub fiscal KEK (EDGE-KEK-1).
CREATE TABLE "edge_pairing_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edge_pairing_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "edge_pairing_codes_codeHash_key" ON "edge_pairing_codes"("codeHash");

CREATE INDEX "edge_pairing_codes_restaurantId_branchId_idx" ON "edge_pairing_codes"("restaurantId", "branchId");
