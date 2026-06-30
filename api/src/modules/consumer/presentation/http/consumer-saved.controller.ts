import { Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { ConsumerAuthGuard } from '../../../consumer-identity/presentation/http/consumer-auth.guard';
import { CurrentConsumer } from '../../../consumer-identity/presentation/http/current-consumer.decorator';
import { ListSavedRestaurantsUseCase } from '../../application/queries/list-saved-restaurants.usecase';
import { SaveRestaurantUseCase } from '../../application/commands/save-restaurant.usecase';
import { UnsaveRestaurantUseCase } from '../../application/commands/unsave-restaurant.usecase';
import {
  ConsumerActionAckResponse,
  SavedRestaurantCardResponse,
} from '../../application/dto/booking-saved.dto';

/**
 * Saved restaurants (CX-3). All routes require a consumer token. @Public() lets the
 * GLOBAL staff/tenant guards skip; ConsumerAuthGuard (aud:consumer) enforces auth.
 */
@ApiTags('Consumer Saved')
@ApiBearerAuth()
@Public()
@UseGuards(ConsumerAuthGuard)
@Controller('consumer/saved')
export class ConsumerSavedController {
  constructor(
    private readonly listSaved: ListSavedRestaurantsUseCase,
    private readonly saveRestaurant: SaveRestaurantUseCase,
    private readonly unsaveRestaurant: UnsaveRestaurantUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Saved branches as cards (unlisted ones flagged listed:false).' })
  @ApiOkResponse({ type: [SavedRestaurantCardResponse] })
  list(@CurrentConsumer() customerAccountId: string): Promise<SavedRestaurantCardResponse[]> {
    return this.listSaved.execute(customerAccountId);
  }

  @Put(':branchId')
  @ApiOperation({ summary: 'Save a branch (idempotent).' })
  @ApiParam({ name: 'branchId', description: 'Globally-unique branch id.' })
  @ApiOkResponse({ type: ConsumerActionAckResponse })
  save(
    @CurrentConsumer() customerAccountId: string,
    @Param('branchId') branchId: string,
  ): Promise<ConsumerActionAckResponse> {
    return this.saveRestaurant.execute({ customerAccountId, branchId });
  }

  @Delete(':branchId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unsave a branch (idempotent).' })
  @ApiParam({ name: 'branchId', description: 'Globally-unique branch id.' })
  @ApiOkResponse({ type: ConsumerActionAckResponse })
  unsave(
    @CurrentConsumer() customerAccountId: string,
    @Param('branchId') branchId: string,
  ): Promise<ConsumerActionAckResponse> {
    return this.unsaveRestaurant.execute({ customerAccountId, branchId });
  }
}
