import { TableSession } from '../entities/table-session';

export const TABLE_SESSION_REPOSITORY = Symbol('TableSessionRepository');

/**
 * TableSession aggregate repository (tenant-scoped). Loads/saves the whole
 * aggregate; no Prisma types cross this boundary.
 */
export interface TableSessionRepository {
  /** The current NON-TERMINAL session for a (branch, table), or null. */
  findActiveByTable(
    restaurantId: string,
    branchId: string,
    tableId: string,
  ): Promise<TableSession | null>;

  findById(restaurantId: string, id: string): Promise<TableSession | null>;

  /**
   * ORDER-2 read-path: resolve the NON-TERMINAL session for an opaque reattach
   * token's SHA-256 hash, tenant-scoped. Terminal sessions clear their hash, so
   * they never match. Returns null when no active session holds that hash.
   */
  findByTokenHash(restaurantId: string, tokenHash: string): Promise<TableSession | null>;

  /**
   * Insert a new session. Throws ActiveTableSessionConflictError if the partial
   * unique index rejects a second non-terminal session for the (branch, table).
   */
  create(session: TableSession): Promise<void>;

  /** Persist a loaded aggregate (state/activity changes). */
  save(session: TableSession): Promise<void>;

  /**
   * Non-terminal sessions whose lastActivityAt is older than their branch's
   * idleExpiryMinutes, capped at `limit` and ordered oldest-first. Used by the
   * idle sweep; the transition itself runs through the aggregate.
   */
  findIdleBatch(now: Date, limit: number): Promise<TableSession[]>;

  /**
   * Conditionally persist an EXPIRED transition: updates the row ONLY if it is
   * still non-terminal, returning true iff this call performed the flip. Makes
   * the sweep idempotent and safe under concurrent instances.
   */
  persistExpiry(session: TableSession): Promise<boolean>;
}
