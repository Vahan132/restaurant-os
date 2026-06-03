import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated } from '../../../../shared/application/pagination';
import { Public } from '../../../../shared/auth/public.decorator';
import { ActivateOrganizationUseCase } from '../../application/commands/activate-organization.usecase';
import { ProvisionOrganizationUseCase } from '../../application/commands/provision-organization.usecase';
import { SuspendOrganizationUseCase } from '../../application/commands/suspend-organization.usecase';
import { CurrentPlatformUser } from '../platform-request';
import { PlatformAccessTokenPayload } from '../../application/ports/platform-token.service';
import { ProvisionOrganizationDto } from '../../application/dto/provision.dto';
import {
  OrganizationDetailResponse,
  OrganizationSummaryResponse,
  ProvisionResponse,
} from '../../application/dto/responses';
import { GetOrganizationUseCase } from '../../application/queries/get-organization.usecase';
import { ListOrganizationsUseCase } from '../../application/queries/list-organizations.usecase';
import { ListOrganizationsQuery } from '../../application/dto/list-organizations.query';
import { PlatformAuthGuard } from '../platform-auth.guard';
import { Inject } from '@nestjs/common';
import {
  PLATFORM_ADMIN_QUERY,
  PlatformAdminQuery,
} from '../../application/ports/platform-admin-query.port';

@ApiTags('platform-organizations')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform/organizations')
export class OrganizationsController {
  constructor(
    private readonly provision: ProvisionOrganizationUseCase,
    private readonly listOrganizations: ListOrganizationsUseCase,
    private readonly getOrganization: GetOrganizationUseCase,
    @Inject(PLATFORM_ADMIN_QUERY) private readonly adminQuery: PlatformAdminQuery,
    private readonly suspend: SuspendOrganizationUseCase,
    private readonly activate: ActivateOrganizationUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Provision a full account (org+subscription+restaurant+settings+roles+owner).',
  })
  @ApiCreatedResponse({ type: ProvisionResponse })
  async create(
    @CurrentPlatformUser() actor: PlatformAccessTokenPayload,
    @Body() dto: ProvisionOrganizationDto,
  ): Promise<ProvisionResponse> {
    return this.provision.execute({
      org: dto.org,
      planCode: dto.planCode,
      restaurant: dto.restaurant,
      owner: dto.owner,
      actorUserId: actor.sub,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List organizations (paginated, platform-wide).' })
  @ApiOkResponse({ type: [OrganizationSummaryResponse] })
  async list(
    @Query() query: ListOrganizationsQuery,
  ): Promise<Paginated<OrganizationSummaryResponse>> {
    const page = await this.listOrganizations.execute({ page: query.page, limit: query.limit });
    return {
      data: page.data.map(OrganizationSummaryResponse.fromListItem),
      pagination: page.pagination,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an organization with restaurants + subscription.' })
  @ApiOkResponse({ type: OrganizationDetailResponse })
  async get(@Param('id') id: string): Promise<OrganizationDetailResponse> {
    const detail = await this.getOrganization.execute({ organizationId: id });
    const billing = await this.adminQuery.orgBilling(id);
    return OrganizationDetailResponse.from(
      detail,
      billing as unknown as Record<string, unknown> | null,
    );
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suspend an organization.' })
  @ApiOkResponse({ type: OrganizationSummaryResponse })
  async suspendOrg(
    @CurrentPlatformUser() actor: PlatformAccessTokenPayload,
    @Param('id') id: string,
  ): Promise<OrganizationSummaryResponse> {
    const org = await this.suspend.execute({ organizationId: id, actorUserId: actor.sub });
    return OrganizationSummaryResponse.fromAggregate(org);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Activate (un-suspend) an organization.' })
  @ApiOkResponse({ type: OrganizationSummaryResponse })
  async activateOrg(@Param('id') id: string): Promise<OrganizationSummaryResponse> {
    const org = await this.activate.execute({ organizationId: id });
    return OrganizationSummaryResponse.fromAggregate(org);
  }
}
