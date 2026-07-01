import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { Paginated } from '../../../../shared/application/pagination';
import { ConsumerAuthGuard } from '../../../consumer-identity/presentation/http/consumer-auth.guard';
import { CurrentConsumer } from '../../../consumer-identity/presentation/http/current-consumer.decorator';
import { GetConsumerBookableSlotsUseCase } from '../../application/queries/get-consumer-bookable-slots.usecase';
import { CreateConsumerReservationUseCase } from '../../application/commands/create-consumer-reservation.usecase';
import { ListMyReservationsUseCase } from '../../application/queries/list-my-reservations.usecase';
import { CancelMyReservationUseCase } from '../../application/commands/cancel-my-reservation.usecase';
import {
  ConsumerActionAckResponse,
  ConsumerBookableSlotsResponse,
  ConsumerReservationConfirmationResponse,
  ConsumerReservationResponse,
  ConsumerSlotsQuery,
  CreateConsumerReservationDto,
  ListMyReservationsQuery,
} from '../../application/dto/booking-saved.dto';

/**
 * Consumer booking (CX-3). @Public() makes the GLOBAL staff/tenant guards skip the
 * whole controller; each authenticated route then opts back in with
 * ConsumerAuthGuard (aud:consumer). The slots route is intentionally anonymous (so
 * the app can show availability pre-login) — only IP-throttled.
 */
@ApiTags('Consumer Booking')
@Public()
@Controller('consumer')
export class ConsumerBookingController {
  constructor(
    private readonly getSlots: GetConsumerBookableSlotsUseCase,
    private readonly createReservation: CreateConsumerReservationUseCase,
    private readonly listMine: ListMyReservationsUseCase,
    private readonly cancelMine: CancelMyReservationUseCase,
  ) {}

  @Get('branches/:branchId/slots')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Engine-computed bookable slots for a branch (anonymous).' })
  @ApiParam({ name: 'branchId', description: 'Globally-unique branch id.' })
  @ApiOkResponse({ type: ConsumerBookableSlotsResponse })
  slots(
    @Param('branchId') branchId: string,
    @Query() query: ConsumerSlotsQuery,
  ): Promise<ConsumerBookableSlotsResponse> {
    return this.getSlots.execute({ branchId, date: query.date, partySize: query.partySize });
  }

  @Post('reservations')
  @UseGuards(ConsumerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a PENDING booking (stamped consumerId) at a slot.' })
  @ApiCreatedResponse({ type: ConsumerReservationConfirmationResponse })
  create(
    @CurrentConsumer() customerAccountId: string,
    @Body() dto: CreateConsumerReservationDto,
  ): Promise<ConsumerReservationConfirmationResponse> {
    return this.createReservation.execute({
      customerAccountId,
      branchId: dto.branchId,
      date: dto.date,
      time: dto.time,
      partySize: dto.partySize,
      note: dto.note ?? null,
    });
  }

  @Get('reservations')
  @UseGuards(ConsumerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "This consumer's reservations, split upcoming | past." })
  @ApiOkResponse({ type: [ConsumerReservationResponse] })
  list(
    @CurrentConsumer() customerAccountId: string,
    @Query() query: ListMyReservationsQuery,
  ): Promise<Paginated<ConsumerReservationResponse>> {
    return this.listMine.execute({
      customerAccountId,
      scope: query.scope,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('reservations/:id/cancel')
  @HttpCode(200)
  @UseGuards(ConsumerAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Self-cancel an upcoming booking (frees the table via the real path).' })
  @ApiParam({ name: 'id', description: 'Reservation id.' })
  @ApiOkResponse({ type: ConsumerActionAckResponse })
  cancel(
    @CurrentConsumer() customerAccountId: string,
    @Param('id') id: string,
  ): Promise<ConsumerActionAckResponse> {
    return this.cancelMine.execute({ customerAccountId, reservationId: id });
  }
}
