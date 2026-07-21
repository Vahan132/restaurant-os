import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { FiscalConfigModule } from '../fiscal-config/fiscal-config.module';
import { IdentityModule } from '../identity/identity.module';
import { IssuePairingCodeUseCase } from './application/commands/issue-pairing-code.usecase';
import { PairEdgeNodeUseCase } from './application/commands/pair-edge-node.usecase';
import { RegisterEdgeNodeUseCase } from './application/commands/register-edge-node.usecase';
import { RevokeEdgeNodeUseCase } from './application/commands/revoke-edge-node.usecase';
import { ListEdgeNodesUseCase } from './application/queries/list-edge-nodes.usecase';
import { GetBranchSnapshotUseCase } from './application/queries/get-branch-snapshot.usecase';
import { GetConfigChangesUseCase } from './application/queries/get-config-changes.usecase';
import { ApplyOperationalPushUseCase } from './application/commands/apply-operational-push.usecase';
import { RecordHeartbeatUseCase } from './application/commands/record-heartbeat.usecase';
import { BRANCH_LOOKUP } from './application/ports/branch-lookup.port';
import { EDGE_READ_MODEL } from './application/ports/edge-read-model';
import { OPERATIONAL_WRITER } from './application/ports/operational-writer';
import { EDGE_NODE_REPOSITORY } from './domain/repositories/edge-node.repository';
import { EDGE_PAIRING_CODE_REPOSITORY } from './domain/repositories/edge-pairing-code.repository';
import { PrismaBranchLookup } from './infrastructure/persistence/prisma-branch-lookup';
import { PrismaEdgeNodeRepository } from './infrastructure/persistence/prisma-edge-node.repository';
import { PrismaEdgePairingCodeRepository } from './infrastructure/persistence/prisma-edge-pairing-code.repository';
import { PrismaEdgeReadModel } from './infrastructure/persistence/prisma-edge-read-model';
import { PrismaOperationalWriter } from './infrastructure/persistence/prisma-operational-writer';
import { EdgeAuthGuard } from './presentation/http/edge-auth.guard';
import { SchemaVersionGuard } from './presentation/http/schema-version.guard';
import { EdgeNodesController } from './presentation/http/edge-nodes.controller';
import { EdgePairController } from './presentation/http/edge-pair.controller';
import { EdgeSnapshotController } from './presentation/http/edge-snapshot.controller';
import { EdgeSyncPushController } from './presentation/http/edge-sync-push.controller';

/**
 * Edge registry (CLOUD-only). Admin-facing node provisioning (/edge-nodes,
 * EDGE_MANAGE), the node-authenticated branch snapshot + config-sync
 * (/edge/snapshot, /edge/config-sync), and the operational push apply
 * (/edge-sync/push, OFF-4) — all behind EdgeAuthGuard. Excluded from the EDGE
 * runtime composition. Imports IdentityModule for ID_GENERATOR.
 */
@Module({
  // EDGE-KEK-1: FiscalConfigModule exports FiscalCryptoService so the read model can
  // re-wrap synced fiscal DEKs to a target hub's per-hub KEK.
  // EDGE-PAIR-3: ThrottlerModule (in-memory, per-instance — matches the rest of the
  // API) backs the ThrottlerGuard on the public /edge/pair + issuance routes.
  imports: [
    IdentityModule,
    FiscalConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [
    EdgeNodesController,
    EdgePairController,
    EdgeSnapshotController,
    EdgeSyncPushController,
  ],
  providers: [
    RegisterEdgeNodeUseCase,
    RevokeEdgeNodeUseCase,
    ListEdgeNodesUseCase,
    IssuePairingCodeUseCase,
    PairEdgeNodeUseCase,
    GetBranchSnapshotUseCase,
    GetConfigChangesUseCase,
    ApplyOperationalPushUseCase,
    RecordHeartbeatUseCase,
    EdgeAuthGuard,
    SchemaVersionGuard,
    { provide: EDGE_NODE_REPOSITORY, useClass: PrismaEdgeNodeRepository },
    { provide: EDGE_PAIRING_CODE_REPOSITORY, useClass: PrismaEdgePairingCodeRepository },
    { provide: BRANCH_LOOKUP, useClass: PrismaBranchLookup },
    { provide: EDGE_READ_MODEL, useClass: PrismaEdgeReadModel },
    { provide: OPERATIONAL_WRITER, useClass: PrismaOperationalWriter },
  ],
})
export class EdgeRegistryModule {}
