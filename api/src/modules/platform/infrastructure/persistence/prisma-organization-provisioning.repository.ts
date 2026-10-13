import { Injectable } from '@nestjs/common';
import {
  OrganizationStatus,
  RestaurantStatus,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { PlanLimitExceededError } from '../../domain/platform.errors';
import {
  OrganizationProvisioningRepository,
  ProvisionResult,
  ProvisionSpec,
} from '../../domain/repositories/provisioning.repository';

/**
 * Provisions a full account inside ONE Prisma transaction (interactive callback).
 * Any failure rolls back every insert (organization, subscription, restaurant,
 * settings, roles, owner user). Enforces the plan's maxRestaurants.
 */
@Injectable()
export class PrismaOrganizationProvisioningRepository implements OrganizationProvisioningRepository {
  constructor(private readonly prisma: PrismaService) {}

  async provision(spec: ProvisionSpec): Promise<ProvisionResult> {
    return this.prisma.$transaction(async (tx) => {
      // Enforce plan restaurant limit (a brand-new org has 0 restaurants).
      const existing = await tx.restaurant.count({
        where: { organizationId: spec.organization.id, deletedAt: null },
      });
      if (existing + 1 > spec.maxRestaurants) {
        throw new PlanLimitExceededError(
          `Plan allows at most ${spec.maxRestaurants} restaurant(s).`,
        );
      }

      // 1) Organization
      await tx.organization.create({
        data: {
          id: spec.organization.id,
          name: spec.organization.name,
          slug: spec.organization.slug,
          status: OrganizationStatus.ACTIVE,
        },
      });

      // 2) Subscription (TRIALING)
      await tx.subscription.create({
        data: {
          id: spec.subscription.id,
          organizationId: spec.organization.id,
          planId: spec.subscription.planId,
          status: spec.subscription.status as SubscriptionStatus,
          trialEndsAt: spec.subscription.trialEndsAt,
          currentPeriodStart: spec.subscription.currentPeriodStart,
          currentPeriodEnd: spec.subscription.currentPeriodEnd,
        },
      });

      // 3) Restaurant + RestaurantSettings (defaults)
      await tx.restaurant.create({
        data: {
          id: spec.restaurant.id,
          organizationId: spec.organization.id,
          name: spec.restaurant.name,
          slug: spec.restaurant.slug,
          currency: spec.restaurant.currency,
          defaultLanguage: spec.restaurant.defaultLanguage,
          timezone: spec.restaurant.timezone,
          status: RestaurantStatus.ACTIVE,
        },
      });
      await tx.restaurantSettings.create({
        data: { id: spec.settings.id, restaurantId: spec.restaurant.id },
      });

      // 4) System roles
      for (const r of spec.roles) {
        await tx.role.create({
          data: {
            id: r.id,
            organizationId: r.organizationId,
            name: r.name,
            code: r.code,
            permissions: r.permissions,
            isSystem: r.isSystem,
            allBranches: r.allBranches,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          },
        });
      }

      // 5) Owner user (password already hashed by identity's UserFactory)
      await tx.user.create({
        data: {
          id: spec.owner.id,
          organizationId: spec.owner.organizationId,
          restaurantId: spec.owner.restaurantId,
          email: spec.owner.email,
          passwordHash: spec.owner.passwordHash,
          fullName: spec.owner.fullName,
          status: UserStatus.ACTIVE,
          roleId: spec.owner.roleId,
        },
      });

      return {
        organizationId: spec.organization.id,
        restaurantId: spec.restaurant.id,
        ownerUserId: spec.owner.id,
      };
    });
  }
}
