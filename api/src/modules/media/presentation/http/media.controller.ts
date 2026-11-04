import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../../../shared/auth/permissions.decorator';
import { CurrentTenant } from '../../../../shared/tenancy/current-tenant.decorator';
import { TenantContext } from '../../../../shared/tenancy/tenant-context';
import { PERMISSIONS } from '../../../identity/domain/permissions.catalog';
import { PresignUploadUseCase } from '../../application/commands/presign-upload.usecase';
import { PresignUploadDto, PresignUploadResponse } from '../../application/dto/media.dto';

/**
 * Media presign endpoints. Each route is guarded by the permission of the image
 * field it targets (MENU_MANAGE for item images, SETTINGS_MANAGE for brand photos
 * + logo). The tenant prefix for the generated key is derived from
 * @CurrentTenant — the client cannot choose the path or another tenant's prefix.
 */
@ApiTags('media')
@ApiBearerAuth('access-token')
@Controller('media')
export class MediaController {
  constructor(private readonly presign: PresignUploadUseCase) {}

  @Post('menu-items/uploads')
  @RequirePermissions(PERMISSIONS.MENU_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing MENU_MANAGE permission.' })
  @ApiOperation({ summary: 'Presign a direct upload for a menu-item image.' })
  @ApiOkResponse({ type: PresignUploadResponse })
  async presignMenuItemImage(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponse> {
    return PresignUploadResponse.from(
      await this.presign.execute({
        restaurantId: tenant.restaurantId,
        target: 'menu-item-image',
        contentType: dto.contentType,
      }),
    );
  }

  @Post('restaurant-photos/uploads')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE permission.' })
  @ApiOperation({ summary: 'Presign a direct upload for a brand gallery photo.' })
  @ApiOkResponse({ type: PresignUploadResponse })
  async presignRestaurantPhoto(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponse> {
    return PresignUploadResponse.from(
      await this.presign.execute({
        restaurantId: tenant.restaurantId,
        target: 'restaurant-photo',
        contentType: dto.contentType,
      }),
    );
  }

  @Post('logo/uploads')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiForbiddenResponse({ description: 'Missing SETTINGS_MANAGE permission.' })
  @ApiOperation({ summary: 'Presign a direct upload for the restaurant logo.' })
  @ApiOkResponse({ type: PresignUploadResponse })
  async presignLogo(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: PresignUploadDto,
  ): Promise<PresignUploadResponse> {
    return PresignUploadResponse.from(
      await this.presign.execute({
        restaurantId: tenant.restaurantId,
        target: 'logo',
        contentType: dto.contentType,
      }),
    );
  }
}
