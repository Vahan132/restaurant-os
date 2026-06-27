import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { IdentityModule } from '../identity/identity.module';
import { TablesModule } from '../tables/tables.module';

import { RESERVATION_REPOSITORY } from './domain/repositories/reservation.repository';
import { CALL_DEVICE_REPOSITORY } from './domain/repositories/call-device.repository';
import { MISSED_CALL_REPOSITORY } from './domain/repositories/missed-call.repository';
import { RESERVATION_SETTINGS_READER } from './application/ports/reservation-settings.reader';
import { RESERVATION_PUBLIC_INFO_READER } from './application/ports/reservation-public-info.reader';
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
import { SubmitPublicReservationUseCase } from './application/commands/submit-public-reservation.usecase';
import { RegisterCallDeviceUseCase } from './application/commands/register-call-device.usecase';
import { RevokeCallDeviceUseCase } from './application/commands/revoke-call-device.usecase';
import { IngestMissedCallsUseCase } from './application/commands/ingest-missed-calls.usecase';
import { HandleMissedCallUseCase } from './application/commands/handle-missed-call.usecase';
import { DismissMissedCallUseCase } from './application/commands/dismiss-missed-call.usecase';
import { CreateReservationFromCallUseCase } from './application/commands/create-reservation-from-call.usecase';
import { ListReservationsUseCase } from './application/queries/list-reservations.usecase';
import { GetReservationUseCase } from './application/queries/get-reservation.usecase';
import { GetTableAvailabilityUseCase } from './application/queries/get-table-availability.usecase';
import { GetPublicReservationsInfoUseCase } from './application/queries/get-public-reservations-info.usecase';
import { ListCallDevicesUseCase } from './application/queries/list-call-devices.usecase';
import { ListMissedCallsUseCase } from './application/queries/list-missed-calls.usecase';
import { ReservationTableSync } from './application/services/reservation-table-sync';

import { PrismaReservationRepository } from './infrastructure/persistence/prisma-reservation.repository';
import { PrismaCallDeviceRepository } from './infrastructure/persistence/prisma-call-device.repository';
import { PrismaMissedCallRepository } from './infrastructure/persistence/prisma-missed-call.repository';
import { PrismaReservationSettingsReader } from './infrastructure/readers/prisma-reservation-settings.reader';
import { PrismaReservationPublicInfoReader } from './infrastructure/readers/prisma-reservation-public-info.reader';
import { PrismaReservationsTableReader } from './infrastructure/readers/prisma-reservations-table.reader';
import { TablesTableStatusGateway } from './infrastructure/gateways/tables-table-status.gateway';

import { ReservationsController } from './presentation/http/reservations.controller';
import { PublicReservationsController } from './presentation/http/public-reservations.controller';
import { ReservationDevicesController } from './presentation/http/reservation-devices.controller';
import { MissedCallsController } from './presentation/http/missed-calls.controller';
import { MissedCallIngestController } from './presentation/http/missed-call-ingest.controller';
import { DeviceTokenGuard } from './presentation/http/device-token.guard';
import { PublicRestaurantResolverGuard } from '../../shared/storefront/public-restaurant.resolver';

/**
 * Reservations module (tenant-scoped). Imports IdentityModule (ID_GENERATOR) and
 * TablesModule (TableStatusService, for auto-mode table effects). Realtime fan-out
 * is handled by the realtime relay reacting to the reservation + missed-call
 * domain events.
 *
 * Surfaces:
 *  - STAFF (tenant-auth, RESERVATION_MANAGE): reservations + device + inbox admin.
 *  - PUBLIC (host/slug-resolved, throttled): request-to-book + booking info.
 *  - DEVICE (bearer device-token): missed-call ingestion.
 */
@Module({
  imports: [IdentityModule, TablesModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
  controllers: [
    ReservationsController,
    PublicReservationsController,
    ReservationDevicesController,
    MissedCallsController,
    MissedCallIngestController,
  ],
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
    SubmitPublicReservationUseCase,
    RegisterCallDeviceUseCase,
    RevokeCallDeviceUseCase,
    IngestMissedCallsUseCase,
    HandleMissedCallUseCase,
    DismissMissedCallUseCase,
    CreateReservationFromCallUseCase,
    ListReservationsUseCase,
    GetReservationUseCase,
    GetTableAvailabilityUseCase,
    GetPublicReservationsInfoUseCase,
    ListCallDevicesUseCase,
    ListMissedCallsUseCase,

    DeviceTokenGuard,
    PublicRestaurantResolverGuard,

    { provide: RESERVATION_REPOSITORY, useClass: PrismaReservationRepository },
    { provide: CALL_DEVICE_REPOSITORY, useClass: PrismaCallDeviceRepository },
    { provide: MISSED_CALL_REPOSITORY, useClass: PrismaMissedCallRepository },
    { provide: RESERVATION_SETTINGS_READER, useClass: PrismaReservationSettingsReader },
    { provide: RESERVATION_PUBLIC_INFO_READER, useClass: PrismaReservationPublicInfoReader },
    { provide: RESERVATIONS_TABLE_READER, useClass: PrismaReservationsTableReader },
    { provide: TABLE_STATUS_GATEWAY, useClass: TablesTableStatusGateway },
  ],
})
export class ReservationsModule {}
