import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import { Paginated } from '../../../../shared/application/pagination';
import { ListConsumerBranchesQuery, ConsumerAvailabilityQuery } from '../../application/dto/query.dto';
import {
  AttributeCategoryResponse,
  ConsumerAvailabilityResponse,
  ConsumerBranchCardResponse,
  ConsumerBranchDetailResponse,
} from '../../application/dto/responses';
import { GetAttributeTaxonomyUseCase } from '../../application/queries/get-attribute-taxonomy.usecase';
import { ListConsumerBranchesUseCase } from '../../application/queries/list-consumer-branches.usecase';
import { GetConsumerBranchDetailUseCase } from '../../application/queries/get-consumer-branch-detail.usecase';
import { GetConsumerBranchAvailabilityUseCase } from '../../application/queries/get-consumer-branch-availability.usecase';

/**
 * PUBLIC, UNAUTHENTICATED consumer discovery API (CX-1). Unlike the storefront,
 * discovery is a CROSS-RESTAURANT marketplace, so it is NOT scoped to a single
 * tenant (no PublicRestaurantResolverGuard) — branches are addressed by their
 * globally-unique branchId (Branch.slug is unique only per restaurant). @Public()
 * makes the tenant JWT/Tenant guards skip these routes; rate-limited per IP.
 */
@ApiTags('Discovery')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('public/discovery')
export class PublicDiscoveryController {
  constructor(
    private readonly getTaxonomy: GetAttributeTaxonomyUseCase,
    private readonly listBranches: ListConsumerBranchesUseCase,
    private readonly getDetail: GetConsumerBranchDetailUseCase,
    private readonly getAvailability: GetConsumerBranchAvailabilityUseCase,
  ) {}

  @Get('attributes')
  @ApiOperation({ summary: 'Attribute taxonomy (categories + values) for the Filters sheet.' })
  @ApiOkResponse({ type: [AttributeCategoryResponse] })
  attributes(): Promise<AttributeCategoryResponse[]> {
    return this.getTaxonomy.execute();
  }

  @Get('restaurants')
  @ApiOperation({
    summary: 'Discovery list of effectively-listed branch cards (search + attribute filter).',
  })
  @ApiOkResponse({ type: [ConsumerBranchCardResponse] })
  restaurants(
    @Query() query: ListConsumerBranchesQuery,
  ): Promise<Paginated<ConsumerBranchCardResponse>> {
    return this.listBranches.execute({
      q: query.q,
      attributeValueIds: query.attributeValueIds,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('restaurants/:branchId')
  @ApiOperation({ summary: 'Full detail for an effectively-listed branch (404 BRANCH_NOT_LISTED).' })
  @ApiParam({ name: 'branchId', description: 'Globally-unique branch id.' })
  @ApiOkResponse({ type: ConsumerBranchDetailResponse })
  detail(@Param('branchId') branchId: string): Promise<ConsumerBranchDetailResponse> {
    return this.getDetail.execute({ branchId });
  }

  @Get('restaurants/:branchId/availability')
  @ApiOperation({
    summary: 'Reservation availability (reuses reservations; 409 RESERVATIONS_NOT_PUBLIC).',
  })
  @ApiParam({ name: 'branchId', description: 'Globally-unique branch id.' })
  @ApiOkResponse({ type: ConsumerAvailabilityResponse })
  availability(
    @Param('branchId') branchId: string,
    @Query() query: ConsumerAvailabilityQuery,
  ): Promise<ConsumerAvailabilityResponse> {
    return this.getAvailability.execute({
      branchId,
      windowStart: query.windowStart,
      windowEnd: query.windowEnd,
    });
  }
}
