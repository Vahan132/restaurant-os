import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  APP_VERSION,
  EDGE_SYNC_BACKLOG_THRESHOLD,
  SCHEMA_VERSION,
} from '../../../../shared/edge/version';
import {
  EDGE_NODE_REPOSITORY,
  EdgeNodeRepository,
} from '../../domain/repositories/edge-node.repository';
import { EdgeNodeNotFound } from '../edge-registry.errors';

export interface RecordHeartbeatInput {
  restaurantId: string;
  nodeId: string;
  schemaVersion: string;
  appVersion: string;
  pendingOutboxCount: number;
}

export interface RecordHeartbeatOutput {
  healthStatus: string;
  schemaMatch: boolean;
  updateRequired: boolean;
  expectedSchemaVersion: string;
  expectedAppVersion: string;
  serverTime: string;
}

/**
 * RecordHeartbeatUseCase (cloud, OFF-8) — applies a hub heartbeat: stamps
 * telemetry + derives/stores health on the node, and tells the hub whether its
 * schema is compatible (so it can pause/resume sync) and whether an operator
 * update is required. Tenant + node come from the authenticated node token.
 */
@Injectable()
export class RecordHeartbeatUseCase implements UseCase<
  RecordHeartbeatInput,
  RecordHeartbeatOutput
> {
  constructor(@Inject(EDGE_NODE_REPOSITORY) private readonly nodes: EdgeNodeRepository) {}

  async execute(input: RecordHeartbeatInput): Promise<RecordHeartbeatOutput> {
    const node = await this.nodes.findById(input.restaurantId, input.nodeId);
    if (!node) {
      throw EdgeNodeNotFound();
    }

    node.recordHeartbeat(
      {
        schemaVersion: input.schemaVersion,
        appVersion: input.appVersion,
        pendingOutboxCount: input.pendingOutboxCount,
      },
      { expectedSchemaVersion: SCHEMA_VERSION, backlogThreshold: EDGE_SYNC_BACKLOG_THRESHOLD },
    );
    await this.nodes.save(node);

    const schemaMatch = input.schemaVersion === SCHEMA_VERSION;
    return {
      healthStatus: node.healthStatus ?? 'OK',
      schemaMatch,
      // A schema gap is the only hard "must update before sync resumes" gate in
      // this MVP. (An app-version gap is surfaced as updateAvailable, not required.)
      updateRequired: !schemaMatch,
      expectedSchemaVersion: SCHEMA_VERSION,
      expectedAppVersion: APP_VERSION,
      serverTime: new Date().toISOString(),
    };
  }
}
