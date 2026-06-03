import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { Organization, OrganizationStatus } from '../../domain/entities/organization';
import {
  OrganizationDetail,
  OrganizationListItem,
  OrganizationRepository,
} from '../../domain/repositories/organization.repository';

@Injectable()
export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Organization | null> {
    const r = await this.prisma.organization.findFirst({ where: { id, deletedAt: null } });
    if (!r) {
      return null;
    }
    return Organization.reconstitute(r.id, {
      name: r.name,
      slug: r.slug,
      status: r.status as OrganizationStatus,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt,
    });
  }

  async existsBySlug(slug: string): Promise<boolean> {
    return (await this.prisma.organization.count({ where: { slug } })) > 0;
  }

  async list(
    skip: number,
    take: number,
  ): Promise<{ items: OrganizationListItem[]; total: number }> {
    const where = { deletedAt: null };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.organization.count({ where }),
    ]);
    return {
      items: records.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        createdAt: r.createdAt,
      })),
      total,
    };
  }

  async getDetail(id: string): Promise<OrganizationDetail | null> {
    const r = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscription: { include: { plan: { select: { code: true } } } },
        restaurants: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });
    if (!r) {
      return null;
    }
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      subscription: r.subscription
        ? {
            id: r.subscription.id,
            planId: r.subscription.planId,
            planCode: r.subscription.plan.code,
            status: r.subscription.status,
            trialEndsAt: r.subscription.trialEndsAt,
            currentPeriodStart: r.subscription.currentPeriodStart,
            currentPeriodEnd: r.subscription.currentPeriodEnd,
          }
        : null,
      restaurants: r.restaurants.map(
        (x: { id: string; name: string; slug: string; status: string }) => ({
          id: x.id,
          name: x.name,
          slug: x.slug,
          status: x.status,
        }),
      ),
    };
  }

  async update(organization: Organization): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        status: organization.status as OrganizationStatus,
        updatedAt: organization.updatedAt,
      },
    });
  }
}
