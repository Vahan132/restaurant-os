import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { STATION_TICKETS_READER } from './application/ports/station-tickets.reader';
import { GetStationTicketsUseCase } from './application/queries/get-station-tickets.usecase';
import { PrismaStationTicketsReader } from './infrastructure/persistence/prisma-station-tickets.reader';
import { KdsController } from './presentation/http/kds.controller';

/**
 * KDS module — station ticket read models + actions. Actions delegate to the
 * orders aggregate (use cases exported by OrdersModule). Real-time fan-out is
 * handled by the realtime module's relay reacting to the orders domain events.
 */
@Module({
  imports: [OrdersModule],
  controllers: [KdsController],
  providers: [
    GetStationTicketsUseCase,
    { provide: STATION_TICKETS_READER, useClass: PrismaStationTicketsReader },
  ],
})
export class KdsModule {}
