import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { IngestMissedCallsUseCase } from '../../application/commands/ingest-missed-calls.usecase';
import {
  IngestMissedCallsDto,
  IngestMissedCallsResponse,
} from '../../application/dto/missed-call.dto';
import { CurrentDevice, DeviceContext } from './device-context';
import { DeviceTokenGuard } from './device-token.guard';

/**
 * Missed-call ingestion — authenticated by a bearer DEVICE token (NOT a user
 * JWT). @Public() bypasses the global JWT/Tenant guards; DeviceTokenGuard then
 * resolves the device + tenant. Ingestion is idempotent and allowed regardless of
 * the enableReservations toggle (a missed call is just a record).
 */
@ApiTags('reservations')
@Public()
@ApiSecurity('device-token')
@UseGuards(DeviceTokenGuard)
@Controller('reservations/missed-calls')
export class MissedCallIngestController {
  constructor(private readonly ingest: IngestMissedCallsUseCase) {}

  @Post('ingest')
  @ApiOperation({ summary: 'Ingest a batch of missed calls (device-token auth; idempotent).' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or revoked device token.' })
  async ingestCalls(
    @CurrentDevice() device: DeviceContext,
    @Body() dto: IngestMissedCallsDto,
  ): Promise<IngestMissedCallsResponse> {
    return this.ingest.execute({
      restaurantId: device.restaurantId,
      branchId: device.branchId,
      deviceId: device.deviceId,
      calls: dto.calls.map((c) => ({
        phoneNumber: c.phoneNumber,
        occurredAt: new Date(c.occurredAt),
        callerName: c.callerName ?? null,
      })),
    });
  }
}
