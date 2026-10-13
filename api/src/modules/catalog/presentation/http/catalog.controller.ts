import { Body, Controller, Inject, Param, Post, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { ActiveBranchId } from '../../../../shared/auth/active-branch.decorator';
import { BranchScoped } from '../../../../shared/auth/branch-scoped.decorator';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { CatalogBundle } from '../../application/catalog-bundle';
import {
  BranchMismatch,
  NoRestaurantInScope,
  SourceBranchForbidden,
  SourceBranchNotFound,
} from '../../application/catalog.errors';
import {
  CatalogReportResponse,
  CloneBodyDto,
  ExportQueryDto,
  ImportBodyDto,
} from '../../application/dto/catalog.dto';
import { CatalogCloneService } from '../../application/services/catalog-clone.service';
import { CatalogExportService } from '../../application/services/catalog-export.service';
import { CatalogImportService } from '../../application/services/catalog-import.service';
import { CatalogWorkbookService } from '../../application/services/catalog-workbook.service';

const MENU_MANAGE = PERMISSIONS.MENU_MANAGE;
const INVENTORY_ITEM_MANAGE = PERMISSIONS.INVENTORY_ITEM_MANAGE;
const INVENTORY_RECIPE_MANAGE = PERMISSIONS.INVENTORY_RECIPE_MANAGE;
const INVENTORY_PROCESS_MANAGE = PERMISSIONS.INVENTORY_PROCESS_MANAGE;

/**
 * Catalog import/export + in-app branch clone (BR-6). All routes are branch-scoped
 * to the TARGET/owning branch and additionally assert the path branch id matches
 * the guard-validated active branch (X-Branch-Id) to prevent acting on a branch
 * whose access was not resolved.
 */
@ApiTags('catalog')
@ApiBearerAuth('access-token')
@BranchScoped()
@Controller('branches/:branchId/catalog')
export class CatalogController {
  constructor(
    private readonly exportService: CatalogExportService,
    private readonly importService: CatalogImportService,
    private readonly cloneService: CatalogCloneService,
    private readonly workbookService: CatalogWorkbookService,
    private readonly prisma: PrismaService,
    @Inject(BRANCH_ACCESS_RESOLVER) private readonly branchAccess: BranchAccessResolver,
  ) {}

  // ── Export ─────────────────────────────────────────────────────────────────
  @Post('export')
  @RequirePermissions(MENU_MANAGE)
  @ApiOperation({ summary: 'Export the branch catalog as a JSON bundle or XLSX review workbook.' })
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOkResponse({ description: 'Catalog bundle (JSON) or XLSX workbook.' })
  async export(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() activeBranchId: string,
    @Param('branchId') branchId: string,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const restaurantId = this.requireRestaurant(tenant);
    if (branchId !== activeBranchId) throw BranchMismatch();

    const bundle = await this.exportService.export({
      restaurantId,
      branchId: activeBranchId,
      include: query.include,
    });

    if (query.format === 'xlsx') {
      const buffer = await this.workbookService.build(bundle);
      res
        .status(200)
        .set({
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="catalog-${activeBranchId}.xlsx"`,
        })
        .send(buffer);
      return;
    }

    res.status(200).json(bundle);
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  @Post('import')
  @RequirePermissions(
    MENU_MANAGE,
    INVENTORY_ITEM_MANAGE,
    INVENTORY_RECIPE_MANAGE,
    INVENTORY_PROCESS_MANAGE,
  )
  @ApiOperation({ summary: 'Import a catalog bundle into this branch (DRY_RUN or APPLY).' })
  @ApiForbiddenResponse({ description: 'Missing catalog manage permissions.' })
  @ApiOkResponse({ type: CatalogReportResponse })
  async import(
    @CurrentTenant() tenant: TenantContext,
    @ActiveBranchId() activeBranchId: string,
    @Param('branchId') branchId: string,
    @Body() body: ImportBodyDto,
  ): Promise<CatalogReportResponse> {
    const restaurantId = this.requireRestaurant(tenant);
    if (branchId !== activeBranchId) throw BranchMismatch();

    const report = await this.importService.import({
      restaurantId,
      targetBranchId: activeBranchId,
      bundle: body.bundle as CatalogBundle,
      mode: body.mode as 'DRY_RUN' | 'APPLY',
      conflictStrategy: body.conflictStrategy as 'SKIP' | 'OVERWRITE' | undefined,
    });
    return CatalogReportResponse.from(report);
  }

  // ── Clone (export source → import target) ──────────────────────────────────
  @Post('clone-from/:sourceBranchId')
  @RequirePermissions(
    MENU_MANAGE,
    INVENTORY_ITEM_MANAGE,
    INVENTORY_RECIPE_MANAGE,
    INVENTORY_PROCESS_MANAGE,
  )
  @ApiOperation({
    summary: 'Clone another branch catalog into this branch (cross-restaurant if accessible).',
  })
  @ApiForbiddenResponse({ description: 'Missing manage permissions or no source-branch access.' })
  @ApiOkResponse({ type: CatalogReportResponse })
  async clone(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: CurrentUserContext,
    @ActiveBranchId() activeBranchId: string,
    @Param('branchId') targetBranchId: string,
    @Param('sourceBranchId') sourceBranchId: string,
    @Body() body: CloneBodyDto,
  ): Promise<CatalogReportResponse> {
    const targetRestaurantId = this.requireRestaurant(tenant);
    if (targetBranchId !== activeBranchId) throw BranchMismatch();

    // Load the source branch row to get ITS restaurant id (supports a source in
    // another restaurant the caller has access to).
    const source = await this.prisma.branch.findFirst({
      where: { id: sourceBranchId, deletedAt: null },
      select: { id: true, restaurantId: true },
    });
    if (!source) throw SourceBranchNotFound();

    const access = await this.branchAccess.resolveForBranch({
      organizationId: tenant.organizationId,
      restaurantId: source.restaurantId,
      userId: actor.sub,
      branchId: sourceBranchId,
    });
    if (!access.hasAccess) throw SourceBranchForbidden();

    const report = await this.cloneService.clone({
      sourceRestaurantId: source.restaurantId,
      sourceBranchId,
      targetRestaurantId,
      targetBranchId: activeBranchId,
      include: body.include,
      mode: body.mode as 'DRY_RUN' | 'APPLY',
      conflictStrategy: body.conflictStrategy as 'SKIP' | 'OVERWRITE' | undefined,
    });
    return CatalogReportResponse.from(report);
  }

  private requireRestaurant(tenant: TenantContext): string {
    if (!tenant.restaurantId) throw NoRestaurantInScope();
    return tenant.restaurantId;
  }
}
