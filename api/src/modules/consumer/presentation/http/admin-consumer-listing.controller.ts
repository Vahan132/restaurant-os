import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import {
  BRANCH_ACCESS_RESOLVER,
  BranchAccessResolver,
} from '../../../../shared/auth/branch-access.resolver';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { CurrentUser } from '../../../../shared/tenancy/current-user.decorator';
import { CurrentUserContext, TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { RestaurantProfileIncompleteError } from '../../domain/consumer.errors';
import {
  AddPhotoDto,
  BooleanValueDto,
  OwnerBranchListingResponse,
  OwnerRestaurantListingResponse,
  ReorderPhotosDto,
  SetAttributesDto,
  SetBranchContactDto,
  SetPublicHoursDto,
  UpdateMarketingProfileDto,
} from '../../application/dto/admin-listing.dto';
import {
  GetOwnerRestaurantListingUseCase,
  OwnerRestaurantListing,
} from '../../application/queries/get-owner-restaurant-listing.usecase';
import {
  GetOwnerBranchListingUseCase,
  OwnerBranchListing,
} from '../../application/queries/get-owner-branch-listing.usecase';
import { UpdateRestaurantMarketingProfileUseCase } from '../../application/commands/update-restaurant-marketing-profile.usecase';
import { SetRestaurantAttributesUseCase } from '../../application/commands/set-restaurant-attributes.usecase';
import { AddRestaurantPhotoUseCase } from '../../application/commands/add-restaurant-photo.usecase';
import { ReorderRestaurantPhotosUseCase } from '../../application/commands/reorder-restaurant-photos.usecase';
import { RemoveRestaurantPhotoUseCase } from '../../application/commands/remove-restaurant-photo.usecase';
import { SetBranchPublicContactUseCase } from '../../application/commands/set-branch-public-contact.usecase';
import { SetBranchPublicHoursUseCase } from '../../application/commands/set-branch-public-hours.usecase';
import {
  SetBranchMenuPublicUseCase,
  SetBranchReservationsPublicUseCase,
} from '../../application/commands/set-branch-visibility.usecase';
import { SetBranchListedUseCase } from '../../application/commands/set-branch-listed.usecase';

const SETTINGS = PERMISSIONS.SETTINGS_MANAGE;
const RESERVATIONS = PERMISSIONS.RESERVATION_MANAGE;

/**
 * Owner-facing consumer-listing WRITE + read-back API (CX-ADMIN). Tenant-scoped
 * (global JwtAuthGuard -> TenantGuard -> PermissionsGuard); every write DELEGATES
 * to an existing CX-1 use-case — no domain logic here. Branch routes take :branchId
 * in the path and validate access via BRANCH_ACCESS_RESOLVER (same semantics as
 * BranchAccessGuard). MANAGE_SETTINGS gates everything except reservations-public,
 * which requires MANAGE_RESERVATIONS.
 */
@ApiTags('Admin Consumer Listing')
@ApiBearerAuth('access-token')
@Controller('admin/consumer-listing')
export class AdminConsumerListingController {
  constructor(
    @Inject(BRANCH_ACCESS_RESOLVER)
    private readonly branchAccess: BranchAccessResolver,
    private readonly getRestaurant: GetOwnerRestaurantListingUseCase,
    private readonly getBranch: GetOwnerBranchListingUseCase,
    private readonly updateProfile: UpdateRestaurantMarketingProfileUseCase,
    private readonly setAttributes: SetRestaurantAttributesUseCase,
    private readonly addPhoto: AddRestaurantPhotoUseCase,
    private readonly reorderPhotos: ReorderRestaurantPhotosUseCase,
    private readonly removePhoto: RemoveRestaurantPhotoUseCase,
    private readonly setContact: SetBranchPublicContactUseCase,
    private readonly setHours: SetBranchPublicHoursUseCase,
    private readonly setMenuPublic: SetBranchMenuPublicUseCase,
    private readonly setReservationsPublic: SetBranchReservationsPublicUseCase,
    private readonly setListed: SetBranchListedUseCase,
  ) {}

  // ── restaurant (brand) ───────────────────────────────────────────────────────

  @Get('restaurant')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Current brand listing config + brand completeness (any listed state).' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE.' })
  @ApiOkResponse({ type: OwnerRestaurantListingResponse })
  async readRestaurant(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<OwnerRestaurantListingResponse> {
    return toRestaurantResponse(await this.getRestaurant.execute({ restaurantId: this.rid(tenant) }));
  }

  @Patch('restaurant')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Update brand marketing profile (about, website).' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE.' })
  @ApiOkResponse({ type: OwnerRestaurantListingResponse })
  async patchRestaurant(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateMarketingProfileDto,
  ): Promise<OwnerRestaurantListingResponse> {
    const restaurantId = this.rid(tenant);
    await this.updateProfile.execute({
      restaurantId,
      about: { hy: dto.about.hy ?? null, ru: dto.about.ru ?? null, en: dto.about.en ?? null },
      website: dto.website ?? null,
    });
    return toRestaurantResponse(await this.getRestaurant.execute({ restaurantId }));
  }

  @Put('restaurant/attributes')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Replace selected attribute value ids.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE.' })
  @ApiOkResponse({ type: OwnerRestaurantListingResponse })
  async putAttributes(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: SetAttributesDto,
  ): Promise<OwnerRestaurantListingResponse> {
    const restaurantId = this.rid(tenant);
    await this.setAttributes.execute({ restaurantId, attributeValueIds: dto.attributeValueIds });
    return toRestaurantResponse(await this.getRestaurant.execute({ restaurantId }));
  }

  @Post('restaurant/photos')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Add a brand photo (https URL-paste; appended at the end).' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE.' })
  @ApiOkResponse({ type: OwnerRestaurantListingResponse })
  async createPhoto(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: AddPhotoDto,
  ): Promise<OwnerRestaurantListingResponse> {
    const restaurantId = this.rid(tenant);
    await this.addPhoto.execute({
      restaurantId,
      url: dto.url,
      alt: dto.alt
        ? { hy: dto.alt.hy ?? null, ru: dto.alt.ru ?? null, en: dto.alt.en ?? null }
        : undefined,
    });
    return toRestaurantResponse(await this.getRestaurant.execute({ restaurantId }));
  }

  @Patch('restaurant/photos/order')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Reorder brand photos to the given id order.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE.' })
  @ApiOkResponse({ type: OwnerRestaurantListingResponse })
  async orderPhotos(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ReorderPhotosDto,
  ): Promise<OwnerRestaurantListingResponse> {
    const restaurantId = this.rid(tenant);
    await this.reorderPhotos.execute({ restaurantId, orderedPhotoIds: dto.orderedPhotoIds });
    return toRestaurantResponse(await this.getRestaurant.execute({ restaurantId }));
  }

  @Delete('restaurant/photos/:photoId')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Remove a brand photo.' })
  @ApiParam({ name: 'photoId', description: 'Brand photo id.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE.' })
  @ApiOkResponse({ type: OwnerRestaurantListingResponse })
  async deletePhoto(
    @CurrentTenant() tenant: TenantContext,
    @Param('photoId') photoId: string,
  ): Promise<OwnerRestaurantListingResponse> {
    const restaurantId = this.rid(tenant);
    await this.removePhoto.execute({ restaurantId, photoId });
    return toRestaurantResponse(await this.getRestaurant.execute({ restaurantId }));
  }

  // ── branch ───────────────────────────────────────────────────────────────────

  @Get('branches/:branchId')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Branch listing config + effective-listing + full completeness.' })
  @ApiParam({ name: 'branchId', description: 'Branch id within the current restaurant.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE, or branch out of scope.' })
  @ApiOkResponse({ type: OwnerBranchListingResponse })
  async readBranch(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('branchId') branchId: string,
  ): Promise<OwnerBranchListingResponse> {
    await this.assertBranch(tenant, user, branchId);
    return toBranchResponse(await this.getBranch.execute({ branchId }));
  }

  @Put('branches/:branchId/contact')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Set branch public contact (phone) + branch-owned address/city.' })
  @ApiParam({ name: 'branchId', description: 'Branch id within the current restaurant.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE, or branch out of scope.' })
  @ApiOkResponse({ type: OwnerBranchListingResponse })
  async putContact(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('branchId') branchId: string,
    @Body() dto: SetBranchContactDto,
  ): Promise<OwnerBranchListingResponse> {
    await this.assertBranch(tenant, user, branchId);
    await this.setContact.execute({
      branchId,
      publicPhone: dto.publicPhone ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
    });
    return toBranchResponse(await this.getBranch.execute({ branchId }));
  }

  @Put('branches/:branchId/hours')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Replace branch weekly public hours.' })
  @ApiParam({ name: 'branchId', description: 'Branch id within the current restaurant.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE, or branch out of scope.' })
  @ApiOkResponse({ type: OwnerBranchListingResponse })
  async putHours(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('branchId') branchId: string,
    @Body() dto: SetPublicHoursDto,
  ): Promise<OwnerBranchListingResponse> {
    await this.assertBranch(tenant, user, branchId);
    await this.setHours.execute({
      branchId,
      rows: dto.rows.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        isClosed: r.isClosed,
        opensAt: r.opensAt ?? null,
        closesAt: r.closesAt ?? null,
      })),
    });
    return toBranchResponse(await this.getBranch.execute({ branchId }));
  }

  @Put('branches/:branchId/menu-public')
  @RequirePermissions(SETTINGS)
  @ApiOperation({ summary: 'Toggle branch menuPublic.' })
  @ApiParam({ name: 'branchId', description: 'Branch id within the current restaurant.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE, or branch out of scope.' })
  @ApiOkResponse({ type: OwnerBranchListingResponse })
  async putMenuPublic(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('branchId') branchId: string,
    @Body() dto: BooleanValueDto,
  ): Promise<OwnerBranchListingResponse> {
    await this.assertBranch(tenant, user, branchId);
    await this.setMenuPublic.execute({ branchId, value: dto.value });
    return toBranchResponse(await this.getBranch.execute({ branchId }));
  }

  @Put('branches/:branchId/listed')
  @RequirePermissions(SETTINGS)
  @ApiOperation({
    summary: 'Toggle listedInConsumerApp (true is completeness-gated).',
  })
  @ApiParam({ name: 'branchId', description: 'Branch id within the current restaurant.' })
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE, or branch out of scope.' })
  @ApiOkResponse({ type: OwnerBranchListingResponse })
  async putListed(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('branchId') branchId: string,
    @Body() dto: BooleanValueDto,
  ): Promise<OwnerBranchListingResponse> {
    await this.assertBranch(tenant, user, branchId);
    try {
      await this.setListed.execute({ branchId, value: dto.value });
    } catch (err) {
      if (err instanceof RestaurantProfileIncompleteError) {
        // The DomainExceptionFilter drops the structured `missing` list; rethrow as
        // a ConflictException so the AllExceptionsFilter surfaces it in `details`.
        throw new ConflictException({
          code: err.code,
          message: err.message,
          details: { missing: err.missing },
        });
      }
      throw err;
    }
    return toBranchResponse(await this.getBranch.execute({ branchId }));
  }

  @Put('branches/:branchId/reservations-public')
  @RequirePermissions(RESERVATIONS)
  @ApiOperation({ summary: 'Toggle reservationsPublic (requires MANAGE_RESERVATIONS).' })
  @ApiParam({ name: 'branchId', description: 'Branch id within the current restaurant.' })
  @ApiForbiddenResponse({ description: 'Missing RESERVATION_MANAGE, or branch out of scope.' })
  @ApiOkResponse({ type: OwnerBranchListingResponse })
  async putReservationsPublic(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: CurrentUserContext,
    @Param('branchId') branchId: string,
    @Body() dto: BooleanValueDto,
  ): Promise<OwnerBranchListingResponse> {
    await this.assertBranch(tenant, user, branchId);
    await this.setReservationsPublic.execute({ branchId, value: dto.value });
    return toBranchResponse(await this.getBranch.execute({ branchId }));
  }

  // ── helpers ──────────────────────────────────────────────────────────────────

  /** Resolve the current restaurant id from the tenant context. */
  private rid(tenant: TenantContext): string {
    if (!tenant.restaurantId) {
      throw new ForbiddenException({
        code: 'RESTAURANT_REQUIRED',
        message: 'This endpoint requires a restaurant-scoped account.',
      });
    }
    return tenant.restaurantId;
  }

  /**
   * Validate the path :branchId belongs to the caller's restaurant and the caller
   * can reach it — mirrors BranchAccessGuard (404 BRANCH_NOT_FOUND / 403 denied).
   */
  private async assertBranch(
    tenant: TenantContext,
    user: CurrentUserContext,
    branchId: string,
  ): Promise<void> {
    const restaurantId = this.rid(tenant);
    const result = await this.branchAccess.resolveForBranch({
      organizationId: tenant.organizationId,
      restaurantId,
      userId: user.sub,
      branchId,
    });
    if (!result.branchExists) {
      throw new NotFoundException({
        code: 'BRANCH_NOT_FOUND',
        message: 'Branch not found in your restaurant.',
      });
    }
    if (!result.hasAccess) {
      throw new ForbiddenException({
        code: 'BRANCH_ACCESS_DENIED',
        message: 'You do not have access to this branch.',
      });
    }
  }
}

// ── response mappers ───────────────────────────────────────────────────────────

function toRestaurantResponse(r: OwnerRestaurantListing): OwnerRestaurantListingResponse {
  return {
    restaurantId: r.restaurantId,
    name: r.name,
    logoUrl: r.logoUrl,
    about: { hy: r.about.hy ?? null, ru: r.about.ru ?? null, en: r.about.en ?? null },
    website: r.website,
    attributeValueIds: r.attributeValueIds,
    photos: r.photos.map((p) => ({
      id: p.id,
      position: p.position,
      url: p.url,
      alt: { hy: p.alt.hy ?? null, ru: p.alt.ru ?? null, en: p.alt.en ?? null },
      width: p.width,
      height: p.height,
    })),
    consumerListingSuppressed: r.consumerListingSuppressed,
    completeness: { isComplete: r.completeness.isComplete, missing: r.completeness.missing },
  };
}

function toBranchResponse(b: OwnerBranchListing): OwnerBranchListingResponse {
  return {
    branchId: b.branchId,
    restaurantId: b.restaurantId,
    publicPhone: b.publicPhone,
    address: b.address,
    city: b.city,
    menuPublic: b.menuPublic,
    reservationsPublic: b.reservationsPublic,
    listedInConsumerApp: b.listedInConsumerApp,
    consumerListingSuppressed: b.consumerListingSuppressed,
    effectiveListed: b.effectiveListed,
    weeklyHours: b.weeklyHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      isClosed: h.isClosed,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
    })),
    completeness: { isComplete: b.completeness.isComplete, missing: b.completeness.missing },
  };
}
