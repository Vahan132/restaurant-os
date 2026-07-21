import { Injectable, Logger } from '@nestjs/common';

export const HUB_RESTART = Symbol('HubRestart');

/**
 * EDGE-SETUP-3A: how the hub restarts itself after a successful pair so the
 * entrypoint re-sources the persisted identity and the process boots operational.
 * Abstracted behind a port so the pairing use case is testable without actually
 * exiting the test process.
 */
export interface HubRestart {
  /** Schedule a process restart (after the current response has been sent). */
  requestRestart(): void;
}

/**
 * Production impl: exit the process shortly after responding. Under Docker
 * (`restart: unless-stopped`) the container restarts and the entrypoint sources
 * the freshly written identity file, bringing the hub up paired.
 */
@Injectable()
export class ProcessExitHubRestart implements HubRestart {
  private readonly logger = new Logger(ProcessExitHubRestart.name);
  /** Small delay so the HTTP response flushes before we exit. */
  private static readonly RESTART_DELAY_MS = 750;

  requestRestart(): void {
    this.logger.log('Pairing complete — restarting to load the new identity.');
    setTimeout(() => process.exit(0), ProcessExitHubRestart.RESTART_DELAY_MS);
  }
}
