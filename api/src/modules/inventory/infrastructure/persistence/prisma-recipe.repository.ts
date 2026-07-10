import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Recipe } from '../../domain/entities/recipe';
import { RecipeListFilter, RecipeRepository } from '../../domain/repositories/recipe.repository';
import { RecipeMapper } from './recipe.mappers';

const CHILDREN = { lines: true, modifierConsumptions: true } as const;

@Injectable()
export class PrismaRecipeRepository implements RecipeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: RecipeListFilter): Promise<{ items: Recipe[]; total: number }> {
    const where: Prisma.RecipeWhereInput = {
      restaurantId: filter.restaurantId,
      branchId: filter.branchId,
      deletedAt: null,
      ...(filter.menuItemId ? { menuItemId: filter.menuItemId } : {}),
      ...(filter.menuItemIds ? { menuItemId: { in: filter.menuItemIds } } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: CHILDREN,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recipe.count({ where }),
    ]);
    return { items: records.map(RecipeMapper.toDomain), total };
  }

  async findById(restaurantId: string, branchId: string, id: string): Promise<Recipe | null> {
    const r = await this.prisma.recipe.findFirst({
      where: { id, restaurantId, branchId, deletedAt: null },
      include: CHILDREN,
    });
    return r ? RecipeMapper.toDomain(r) : null;
  }

  // Recipe uniqueness is restaurant-wide (@@unique([restaurantId, menuItemId])):
  // this lookup stays branch-AGNOSTIC (backs create uniqueness + order consumption).
  async findByMenuItemIds(
    restaurantId: string,
    menuItemIds: readonly string[],
  ): Promise<Recipe[]> {
    if (menuItemIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.recipe.findMany({
      where: { restaurantId, menuItemId: { in: [...new Set(menuItemIds)] }, deletedAt: null },
      include: CHILDREN,
    });
    return rows.map(RecipeMapper.toDomain);
  }

  async findByMenuItemId(restaurantId: string, menuItemId: string): Promise<Recipe | null> {
    const r = await this.prisma.recipe.findFirst({
      where: { restaurantId, menuItemId, deletedAt: null },
      include: CHILDREN,
    });
    return r ? RecipeMapper.toDomain(r) : null;
  }

  async create(recipe: Recipe): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.recipe.create({ data: RecipeMapper.toHeaderCreate(recipe) });
      await tx.recipeLine.createMany({ data: RecipeMapper.toLineRows(recipe) });
      await tx.modifierConsumption.createMany({
        data: RecipeMapper.toModifierConsumptionRows(recipe),
      });
    });
  }

  async update(recipe: Recipe): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.recipe.updateMany({
        where: { id: recipe.id, restaurantId: recipe.restaurantId },
        data: RecipeMapper.toHeaderUpdate(recipe),
      });
      // Full replace of children (delete + re-insert from the aggregate).
      await tx.recipeLine.deleteMany({ where: { recipeId: recipe.id } });
      await tx.modifierConsumption.deleteMany({ where: { recipeId: recipe.id } });
      await tx.recipeLine.createMany({ data: RecipeMapper.toLineRows(recipe) });
      await tx.modifierConsumption.createMany({
        data: RecipeMapper.toModifierConsumptionRows(recipe),
      });
    });
  }
}
