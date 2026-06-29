/**
 * Edge runtime version constants. Reported by GET /edge/info so LAN clients
 * (OFF-6) and monitoring (OFF-8) can confirm they're paired to a compatible hub.
 */

/** Application version (kept in sync with package.json). */
export const APP_VERSION = '0.1.0';

/**
 * Edge sync schema/contract version — an APP CONSTANT (NOT the Prisma migration
 * name). It is the single value the cloud and the edge compare to decide whether
 * a hub may sync. BUMP THIS whenever an edge-incompatible schema or wire-contract
 * change ships (a change that would make the cloud and an older hub disagree on
 * how to (de)serialize a snapshot / config window / operational push). Patch-only
 * or additive-compatible changes do not need a bump.
 *
 * Using a constant (rather than the latest migration name) means cloud and edge
 * compare the SAME value regardless of how many internal migrations each side
 * has applied — only deliberate, breaking bumps cause a SCHEMA_MISMATCH.
 */
// '3' (3B): the snapshot/config-sync contracts now carry device-anchored auth
// material (devices + StaffPin hashes) and the operational push gained the
// STAFF_PIN_AUTH aggregate — an older hub would not (de)serialize these, so the
// bump forces a SCHEMA_MISMATCH until both sides update.
export const SCHEMA_VERSION = '3';

/**
 * HTTP header the edge sends on every sync request carrying its reported edge
 * schema version. The cloud SchemaVersionGuard compares it to SCHEMA_VERSION.
 */
export const EDGE_SCHEMA_VERSION_HEADER = 'x-edge-schema-version';

/**
 * How long the cloud waits for a heartbeat before deriving a node as OFFLINE.
 * OFFLINE is never stored — it is computed on read from lastHeartbeatAt recency
 * (a crashed/powered-off hub cannot tell us it went away). Default 3 minutes
 * comfortably covers the 30–60s heartbeat cadence plus a missed beat or two.
 */
export const EDGE_OFFLINE_THRESHOLD_MS = 180_000;

/**
 * Pending-outbox count above which a node's health is reported as SYNC_BACKLOG
 * (it is online and schema-compatible, but its edge→cloud queue is draining
 * slowly / it has been offline a while). Informational — the hub keeps serving.
 */
export const EDGE_SYNC_BACKLOG_THRESHOLD = 100;
