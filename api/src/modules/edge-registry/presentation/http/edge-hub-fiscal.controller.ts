import { Body, Controller, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../../../../shared/auth/public.decorator';
import { BranchFiscalSettingsService } from '../../../fiscal-config/application/services/branch-fiscal-settings.service';
import {
  BranchFiscalSettingsResponse,
  BranchFiscalSettingsView,
  SaveBranchFiscalDepartmentsDto,
  SaveBranchHdmDto,
} from '../../../fiscal-config/presentation/http/branch-fiscal-settings.controller';
import { EnsureHubFiscalKekUseCase } from '../../application/commands/ensure-hub-fiscal-kek.usecase';
import { CurrentEdgeNode, EdgeNodeContext } from './edge-node-context';
import { EdgeAuthGuard } from './edge-auth.guard';

/** `actorId` = the hub user who saved (cloud ids are mirrored on the hub), for the audit log. */
export class HubSaveBranchHdmDto extends SaveBranchHdmDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string | null;
}

export class HubSaveBranchDepartmentsDto extends SaveBranchFiscalDepartmentsDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorId?: string | null;
}

/**
 * Hub → cloud fiscal relay (node-token auth). EDGE-KEK-2 delivers the per-hub
 * KEK; HDM-EDGE-1 lets the admin served BY THE HUB save the branch HDM settings:
 * the hub (which already checked SETTINGS_MANAGE on its own JWT) forwards here,
 * the cloud stays the source of truth, and the change flows back down by config
 * sync. Branch/restaurant come ONLY from the node token — never from the body.
 */
@ApiTags('edge-sync')
@Public()
@ApiSecurity('edge-node-token')
@UseGuards(EdgeAuthGuard)
@Controller('edge-sync')
export class EdgeHubFiscalController {
  constructor(
    private readonly kek: EnsureHubFiscalKekUseCase,
    private readonly settings: BranchFiscalSettingsService,
  ) {}

  @Post('fiscal-kek')
  @HttpCode(200)
  @ApiOperation({ summary: "Deliver this hub's per-hub fiscal KEK (minted on first call)." })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or revoked node token.' })
  async fiscalKek(
    @CurrentEdgeNode() node: EdgeNodeContext,
  ): Promise<{ fiscalKek: string | null; created: boolean }> {
    return this.kek.execute(node.nodeId);
  }

  @Put('fiscal-settings/hdm')
  @ApiOperation({ summary: "Save the hub branch's HDM device (relayed from the hub admin)." })
  @ApiOkResponse({ type: BranchFiscalSettingsResponse })
  async saveHdm(
    @CurrentEdgeNode() node: EdgeNodeContext,
    @Body() dto: HubSaveBranchHdmDto,
  ): Promise<BranchFiscalSettingsResponse> {
    const s = await this.settings.saveHdm({
      restaurantId: node.restaurantId,
      branchId: node.branchId,
      actorId: dto.actorId ?? null,
      active: dto.active,
      crn: dto.crn,
      host: dto.host,
      port: dto.port,
      password: dto.password,
      cashierId: dto.cashierId,
      pin: dto.pin,
      useExtPos: dto.useExtPos,
      printMode: dto.printMode,
    });
    return { settings: BranchFiscalSettingsView.from(s) };
  }

  @Put('fiscal-settings/departments')
  @ApiOperation({ summary: "Replace the hub branch's HDM departments (relayed from the hub)." })
  @ApiOkResponse({ type: BranchFiscalSettingsResponse })
  async saveDepartments(
    @CurrentEdgeNode() node: EdgeNodeContext,
    @Body() dto: HubSaveBranchDepartmentsDto,
  ): Promise<BranchFiscalSettingsResponse> {
    const s = await this.settings.saveDepartments(
      node.restaurantId,
      node.branchId,
      dto.actorId ?? null,
      dto.departments.map((d) => ({
        dep: d.dep.trim(),
        taxRegime: d.taxRegime.trim(),
        label: d.label?.trim() || null,
      })),
    );
    return { settings: BranchFiscalSettingsView.from(s) };
  }
}
