import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { REALTIME_USER_READER } from './application/ports/realtime-user.reader';
import { RealtimePublisher } from './application/realtime-publisher.service';
import { RealtimeRelay } from './application/realtime-relay';
import { PrismaRealtimeUserReader } from './infrastructure/prisma-realtime-user.reader';
import { RealtimeGateway } from './presentation/realtime.gateway';

/**
 * Realtime module — Socket.IO gateway (/realtime), event relay (domain events ->
 * broadcasts) and the publisher. The Redis adapter is wired in main.ts. JwtModule
 * is imported so the gateway can verify handshake access tokens.
 */
@Module({
  imports: [JwtModule.register({})],
  providers: [
    RealtimeGateway,
    RealtimePublisher,
    RealtimeRelay,
    { provide: REALTIME_USER_READER, useClass: PrismaRealtimeUserReader },
  ],
  exports: [RealtimePublisher],
})
export class RealtimeModule {}
