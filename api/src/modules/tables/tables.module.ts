import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';

import { FLOOR_REPOSITORY } from './domain/repositories/floor.repository';
import { RESTAURANT_TABLE_REPOSITORY } from './domain/repositories/restaurant-table.repository';
import { TABLE_SETTINGS_READER } from './application/ports/table-settings.reader';
import { FLOOR_PLAN_READER } from './application/ports/floor-plan.reader';

import { ListFloorsUseCase } from './application/queries/list-floors.usecase';
import { CreateFloorUseCase } from './application/commands/create-floor.usecase';
import { UpdateFloorUseCase } from './application/commands/update-floor.usecase';
import { ReorderFloorsUseCase } from './application/commands/reorder-floors.usecase';
import { SetFloorStatusUseCase } from './application/commands/set-floor-status.usecase';
import { DeleteFloorUseCase } from './application/commands/delete-floor.usecase';
import { ListTablesUseCase } from './application/queries/list-tables.usecase';
import { GetTableUseCase } from './application/queries/get-table.usecase';
import { GetFloorPlanUseCase } from './application/queries/get-floor-plan.usecase';
import { CreateTableUseCase } from './application/commands/create-table.usecase';
import { UpdateTableUseCase } from './application/commands/update-table.usecase';
import { DeleteTableUseCase } from './application/commands/delete-table.usecase';
import { ChangeTableStatusManualUseCase } from './application/commands/change-table-status-manual.usecase';
import { TableStatusService } from './application/services/table-status.service';

import { PrismaFloorRepository } from './infrastructure/persistence/prisma-floor.repository';
import { PrismaRestaurantTableRepository } from './infrastructure/persistence/prisma-restaurant-table.repository';
import { PrismaTableSettingsReader } from './infrastructure/persistence/prisma-table-settings.reader';
import { PrismaFloorPlanReader } from './infrastructure/persistence/prisma-floor-plan.reader';

import { FloorsController } from './presentation/http/floors.controller';
import { TablesController } from './presentation/http/tables.controller';

/**
 * Tables module (tenant-scoped by restaurantId). Config writes need TABLE_MANAGE;
 * status writes need TABLE_STATUS_UPDATE; reads need auth. Exports
 * TableStatusService so Orders (prompt 6) and Reservations (prompt 8) can drive
 * SYSTEM status transitions.
 */
@Module({
  imports: [IdentityModule],
  controllers: [FloorsController, TablesController],
  providers: [
    // floors
    ListFloorsUseCase,
    CreateFloorUseCase,
    UpdateFloorUseCase,
    ReorderFloorsUseCase,
    SetFloorStatusUseCase,
    DeleteFloorUseCase,
    // tables
    ListTablesUseCase,
    GetTableUseCase,
    GetFloorPlanUseCase,
    CreateTableUseCase,
    UpdateTableUseCase,
    DeleteTableUseCase,
    ChangeTableStatusManualUseCase,
    TableStatusService,

    // port -> implementation bindings
    { provide: FLOOR_REPOSITORY, useClass: PrismaFloorRepository },
    { provide: RESTAURANT_TABLE_REPOSITORY, useClass: PrismaRestaurantTableRepository },
    { provide: TABLE_SETTINGS_READER, useClass: PrismaTableSettingsReader },
    { provide: FLOOR_PLAN_READER, useClass: PrismaFloorPlanReader },
  ],
  exports: [TableStatusService],
})
export class TablesModule {}
