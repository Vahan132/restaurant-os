import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { TablesModule } from '../tables/tables.module';

import { RESERVATION_REPOSITORY } from './domain/repositories/reservation.repository';
import { RESERVATION_SETTINGS_READER } from './application/ports/reservation-settings.reader';
import { RESERVATIONS_TABLE_READER } from './application/ports/reservations-table.reader';
import { TABLE_STATUS_GATEWAY } from './application/ports/table-status.gateway';

import { CreateReservationUseCase } from './application/commands/create-reservation.usecase';
import { UpdateReservationUseCase } from './application/commands/update-reservation.usecase';
import { ConfirmReservationUseCase } from './application/commands/confirm-reservation.usecase';
import { AssignTableUseCase } from './application/commands/assign-table.usecase';
import { ClearTableUseCase } from './application/commands/clear-table.usecase';
import { MarkArrivedUseCase } from './application/commands/mark-arrived.usecase';
import { MarkSeatedUseCase } from './application/commands/mark-seated.usecase';
import { MarkNoShowUseCase } from './application/commands/mark-no-show.usecase';
import { CancelReservationUseCase } from './application/commands/cancel-reservation.usecase';
import { CompleteReservationUseCase } from './application/commands/complete-reservation.usecase';
import { ListReservationsUseCase } from './application/queries/list-reservations.usecase';
import { GetReservationUseCase } from './application/queries/get-reservation.usecase';
import { GetTableAvailabilityUseCase } from './application/queries/get-table-availability.usecase';
import { ReservationTableSync } from './application/services/reservation-table-sync';

import { PrismaReservationRepository } from './infrastructure/persistence/prisma-reservation.repository';
import { PrismaReservationSettingsReader } from './infrastructure/readers/prisma-reservation-settings.reader';
import { PrismaReservationsTableReader } from './infrastructure/readers/prisma-reservations-table.reader';
import { TablesTableStatusGateway } from './infrastructure/gateways/tables-table-status.gateway';

import { ReservationsController } from './presentation/http/reservations.controller';

/**
 * Reservations module (tenant-scoped). Imports IdentityModule (ID_GENERATOR) and
 * TablesModule (TableStatusService, for auto-mode table effects). Realtime fan-out
 * is handled by the realtime relay reacting to the reservation domain events.
 */
@Module({
  imports: [IdentityModule, TablesModule],
  controllers: [ReservationsController],
  providers: [
    ReservationTableSync,
    CreateReservationUseCase,
    UpdateReservationUseCase,
    ConfirmReservationUseCase,
    AssignTableUseCase,
    ClearTableUseCase,
    MarkArrivedUseCase,
    MarkSeatedUseCase,
    MarkNoShowUseCase,
    CancelReservationUseCase,
    CompleteReservationUseCase,
    ListReservationsUseCase,
    GetReservationUseCase,
    GetTableAvailabilityUseCase,

    { provide: RESERVATION_REPOSITORY, useClass: PrismaReservationRepository },
    { provide: RESERVATION_SETTINGS_READER, useClass: PrismaReservationSettingsReader },
    { provide: RESERVATIONS_TABLE_READER, useClass: PrismaReservationsTableReader },
    { provide: TABLE_STATUS_GATEWAY, useClass: TablesTableStatusGateway },
  ],
})
export class ReservationsModule {}
