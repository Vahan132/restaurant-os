export const EDGE_PAIRING_CODE_REPOSITORY = Symbol('EdgePairingCodeRepository');

/** A stored pairing code (never holds the plaintext — only its sha256 hash). */
export interface EdgePairingCodeRecord {
  id: string;
  codeHash: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
  name: string;
  createdByUserId: string;
  expiresAt: Date;
  consumedAt: Date | null;
  nodeId: string | null;
}

export interface CreatePairingCodeInput {
  id: string;
  codeHash: string;
  organizationId: string;
  restaurantId: string;
  branchId: string;
  name: string;
  createdByUserId: string;
  expiresAt: Date;
}

/**
 * EDGE-PAIR-2 pairing-code store. Single-use is enforced atomically in
 * `consume()` (a conditional update), so two hubs racing the same code cannot
 * both redeem it.
 */
export interface EdgePairingCodeRepository {
  create(input: CreatePairingCodeInput): Promise<void>;
  /** Find an UNCONSUMED, UNEXPIRED code by hash, evaluated at `now`. */
  findRedeemable(codeHash: string, now: Date): Promise<EdgePairingCodeRecord | null>;
  /**
   * Atomically claim the code (set consumedAt + nodeId) IFF still unconsumed and
   * unexpired. Returns true when this caller won the claim, false otherwise —
   * guaranteeing exactly-once redemption.
   */
  consume(id: string, nodeId: string, at: Date): Promise<boolean>;
}
