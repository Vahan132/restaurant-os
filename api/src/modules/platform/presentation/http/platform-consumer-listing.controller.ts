import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../shared/auth/public.decorator';
import {
  AttributeCategoryResponse,
  AttributeValueResponse,
} from '../../../consumer/application/dto/responses';
import {
  CreateAttributeCategoryDto,
  CreateAttributeValueDto,
  SetSuppressedDto,
  SuppressionStateResponse,
  UpdateAttributeCategoryDto,
  UpdateAttributeValueDto,
} from '../../../consumer/application/dto/platform-listing.dto';
import { TaxonomyCategory, TaxonomyValue } from '../../../consumer/domain/repositories/attribute-taxonomy.repository';
import { SetConsumerListingSuppressedUseCase } from '../../../consumer/application/commands/set-consumer-listing-suppressed.usecase';
import { GetFullAttributeTaxonomyUseCase } from '../../../consumer/application/queries/get-full-attribute-taxonomy.usecase';
import {
  CreateAttributeCategoryUseCase,
  CreateAttributeValueUseCase,
  DeleteAttributeCategoryUseCase,
  DeleteAttributeValueUseCase,
  UpdateAttributeCategoryUseCase,
  UpdateAttributeValueUseCase,
} from '../../../consumer/application/commands/manage-attribute-taxonomy.usecase';
import { PlatformAuthGuard } from '../platform-auth.guard';

/**
 * Platform-admin consumer-listing controller (CX-ADMIN): the brand kill switch +
 * attribute-taxonomy CRUD. PLATFORM-scoped — @Public() skips the tenant guards and
 * PlatformAuthGuard enforces a valid platform token. Delegates to the consumer
 * domain use-cases (imported via ConsumerModule). Deleting an in-use value is
 * blocked (ATTRIBUTE_VALUE_IN_USE).
 */
@ApiTags('Platform Consumer Listing')
@ApiBearerAuth('platform-token')
@Public()
@UseGuards(PlatformAuthGuard)
@Controller('platform-admin')
export class PlatformConsumerListingController {
  constructor(
    private readonly setSuppressed: SetConsumerListingSuppressedUseCase,
    private readonly getTaxonomy: GetFullAttributeTaxonomyUseCase,
    private readonly createCategory: CreateAttributeCategoryUseCase,
    private readonly updateCategory: UpdateAttributeCategoryUseCase,
    private readonly deleteCategory: DeleteAttributeCategoryUseCase,
    private readonly createValue: CreateAttributeValueUseCase,
    private readonly updateValue: UpdateAttributeValueUseCase,
    private readonly deleteValue: DeleteAttributeValueUseCase,
  ) {}

  // ── kill switch ──────────────────────────────────────────────────────────────

  @Put('consumer-listing/restaurants/:restaurantId/suppressed')
  @ApiOperation({ summary: 'Set the brand consumer-listing kill switch (overrides owner listing).' })
  @ApiParam({ name: 'restaurantId', description: 'Target restaurant id.' })
  @ApiOkResponse({ type: SuppressionStateResponse })
  async suppress(
    @Param('restaurantId') restaurantId: string,
    @Body() dto: SetSuppressedDto,
  ): Promise<SuppressionStateResponse> {
    await this.setSuppressed.execute({ restaurantId, value: dto.value });
    return { restaurantId, consumerListingSuppressed: dto.value };
  }

  // ── taxonomy ─────────────────────────────────────────────────────────────────

  @Get('attributes')
  @ApiOperation({ summary: 'Full attribute taxonomy (incl. non-filterable categories).' })
  @ApiOkResponse({ type: [AttributeCategoryResponse] })
  async listAttributes(): Promise<AttributeCategoryResponse[]> {
    const categories = await this.getTaxonomy.execute();
    return categories.map(toCategoryResponse);
  }

  @Post('attributes/categories')
  @ApiOperation({ summary: 'Create an attribute category.' })
  @ApiOkResponse({ type: AttributeCategoryResponse })
  async postCategory(@Body() dto: CreateAttributeCategoryDto): Promise<AttributeCategoryResponse> {
    const category = await this.createCategory.execute({
      slug: dto.slug,
      labelHy: dto.labelHy,
      labelRu: dto.labelRu,
      labelEn: dto.labelEn,
      position: dto.position,
      isFilterable: dto.isFilterable,
    });
    return toCategoryResponse(category);
  }

  @Patch('attributes/categories/:id')
  @ApiOperation({ summary: 'Update an attribute category.' })
  @ApiParam({ name: 'id', description: 'Attribute category id.' })
  @ApiOkResponse({ type: AttributeCategoryResponse })
  async patchCategory(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeCategoryDto,
  ): Promise<AttributeCategoryResponse> {
    const category = await this.updateCategory.execute({
      categoryId: id,
      labelHy: dto.labelHy,
      labelRu: dto.labelRu,
      labelEn: dto.labelEn,
      position: dto.position,
      isFilterable: dto.isFilterable,
    });
    return toCategoryResponse(category);
  }

  @Delete('attributes/categories/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an attribute category (blocked if any value is in use).' })
  @ApiParam({ name: 'id', description: 'Attribute category id.' })
  async deleteCategoryRoute(@Param('id') id: string): Promise<void> {
    await this.deleteCategory.execute({ categoryId: id });
  }

  @Post('attributes/categories/:id/values')
  @ApiOperation({ summary: 'Add a value to a category.' })
  @ApiParam({ name: 'id', description: 'Attribute category id.' })
  @ApiOkResponse({ type: AttributeValueResponse })
  async postValue(
    @Param('id') id: string,
    @Body() dto: CreateAttributeValueDto,
  ): Promise<AttributeValueResponse> {
    const value = await this.createValue.execute({
      categoryId: id,
      slug: dto.slug,
      labelHy: dto.labelHy,
      labelRu: dto.labelRu,
      labelEn: dto.labelEn,
      position: dto.position,
    });
    return toValueResponse(value);
  }

  @Patch('attributes/values/:id')
  @ApiOperation({ summary: 'Update an attribute value.' })
  @ApiParam({ name: 'id', description: 'Attribute value id.' })
  @ApiOkResponse({ type: AttributeValueResponse })
  async patchValue(
    @Param('id') id: string,
    @Body() dto: UpdateAttributeValueDto,
  ): Promise<AttributeValueResponse> {
    const value = await this.updateValue.execute({
      valueId: id,
      labelHy: dto.labelHy,
      labelRu: dto.labelRu,
      labelEn: dto.labelEn,
      position: dto.position,
    });
    return toValueResponse(value);
  }

  @Delete('attributes/values/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete an attribute value (blocked if in use → ATTRIBUTE_VALUE_IN_USE).' })
  @ApiParam({ name: 'id', description: 'Attribute value id.' })
  async deleteValueRoute(@Param('id') id: string): Promise<void> {
    await this.deleteValue.execute({ valueId: id });
  }
}

// ── mappers ──────────────────────────────────────────────────────────────────

function toValueResponse(v: TaxonomyValue): AttributeValueResponse {
  return {
    id: v.id,
    slug: v.slug,
    labelHy: v.labelHy,
    labelRu: v.labelRu,
    labelEn: v.labelEn,
    position: v.position,
  };
}

function toCategoryResponse(c: TaxonomyCategory): AttributeCategoryResponse {
  return {
    id: c.id,
    slug: c.slug,
    labelHy: c.labelHy,
    labelRu: c.labelRu,
    labelEn: c.labelEn,
    position: c.position,
    isFilterable: c.isFilterable,
    values: c.values.map(toValueResponse),
  };
}
