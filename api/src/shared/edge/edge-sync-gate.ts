import { Injectable, Logger } from '@nestjs/common';

/**
 * EdgeSyncGate (OFF-8) — an in-memory latch that PAUSES cloud↔edge sync when the
 * cloud reports the hub's edge schema version is incompatible (SCHEMA_MISMATCH).
 *
 * While paused, the hub keeps operating LOCALLY (serving the floor) but stops
 * pulling/pushing, so a stale hub cannot exchange possibly-incompatible payloads.
 * The latch is cleared automatically once a heartbeat reports the versions match
 * again (i.e. after the operator updates the hub) — sync then resumes on its own.
 *
 * GLOBAL and always provided; simply inert in CLOUD (nothing ever pauses it).
 */
@Injectable()
export class EdgeSyncGate {
  private readonly logger = new Logger(EdgeSyncGate.name);
  private paused = false;
  private updateRequired = false;
  private expectedSchemaVersion: string | null = null;
  private lastHeartbeatAt: Date | null = null;

  /** Latch sync paused due to a schema-version gap. Idempotent. */
  pauseForSchemaMismatch(expectedSchemaVersion?: string | null): void {
    if (expectedSchemaVersion) {
      this.expectedSchemaVersion = expectedSchemaVersion;
    }
    this.updateRequired = true;
    if (!this.paused) {
      this.paused = true;
      this.logger.warn(
        `Sync PAUSED — edge schema version is incompatible with the cloud` +
          (this.expectedSchemaVersion ? ` (cloud expects ${this.expectedSchemaVersion}).` : '.') +
          ' Update required; the hub keeps serving locally. Sync resumes once versions match.',
      );
    }
  }

  /** Clear the latch (versions match again). Idempotent. */
  resume(): void {
    if (this.paused) {
      this.logger.log('Sync RESUMED — edge schema version matches the cloud again.');
    }
    this.paused = false;
    this.updateRequired = false;
    this.expectedSchemaVersion = null;
  }

  /** True while sync is paused for a schema mismatch. */
  get isPaused(): boolean {
    return this.paused;
  }

  /** True while an operator update is required (surfaced via /edge/info). */
  get isUpdateRequired(): boolean {
    return this.updateRequired;
  }

  /** The schema version the cloud last said it expects, if known. */
  get expected(): string | null {
    return this.expectedSchemaVersion;
  }

  /** Record that the hub successfully reached the cloud with a heartbeat. */
  markHeartbeat(at: Date = new Date()): void {
    this.lastHeartbeatAt = at;
  }

  /** When the hub last successfully heartbeated to the cloud (null if never). */
  get lastHeartbeat(): Date | null {
    return this.lastHeartbeatAt;
  }
}
