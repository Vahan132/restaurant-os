import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  AttributeSummaryItem,
  BranchPublicRepository,
  BranchPublicState,
  ConsumerBranchCard,
  ConsumerBranchDetail,
  FeatureGroup,
  ListConsumerBranchesFilter,
  PublicHoursRecord,
  SetBranchContactInput,
} from '../../domain/repositories/branch-public.repository';

const CARD_ATTRIBUTE_SUMMARY_LIMIT = 6;

/**
 * Branch public persistence + the anonymous discovery read queries (Prisma
 * directly). Every read applies the EFFECTIVE-LISTING rule and does search +
 * attribute filtering + pagination at the query level.
 */
@Injectable()
export class PrismaBranchPublicRepository implements BranchPublicRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── writes ───────────────────────────────────────────────────────────────
  async loadState(branchId: string): Promise<BranchPublicState | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null },
      select: {
        id: true,
        restaurantId: true,
        address: true,
        city: true,
        publicPhone: true,
        menuPublic: true,
        reservationsPublic: true,
        listedInConsumerApp: true,
        restaurant: { select: { consumerListingSuppressed: true } },
      },
    });
    if (!branch) {
      return null;
    }
    const openHoursCount = await this.prisma.branchPublicHours.count({
      where: { branchId, isClosed: false },
    });
    return {
      branchId: branch.id,
      restaurantId: branch.restaurantId,
      address: branch.address,
      city: branch.city,
      publicPhone: branch.publicPhone,
      menuPublic: branch.menuPublic,
      reservationsPublic: branch.reservationsPublic,
      listedInConsumerApp: branch.listedInConsumerApp,
      consumerListingSuppressed: branch.restaurant.consumerListingSuppressed,
      openHoursCount,
    };
  }

  async listPublicHours(branchId: string): Promise<PublicHoursRecord[]> {
    const rows = await this.prisma.branchPublicHours.findMany({
      where: { branchId },
      select: { dayOfWeek: true, isClosed: true, opensAt: true, closesAt: true },
      orderBy: { dayOfWeek: 'asc' },
    });
    return rows.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      isClosed: h.isClosed,
      opensAt: h.opensAt,
      closesAt: h.closesAt,
    }));
  }

  async setPublicContact(branchId: string, input: SetBranchContactInput): Promise<void> {
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { publicPhone: input.publicPhone, address: input.address, city: input.city },
    });
  }

  async setPublicHours(branchId: string, rows: PublicHoursRecord[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.branchPublicHours.deleteMany({ where: { branchId } }),
      this.prisma.branchPublicHours.createMany({
        data: rows.map((r) => ({
          branchId,
          dayOfWeek: r.dayOfWeek,
          isClosed: r.isClosed,
          opensAt: r.opensAt,
          closesAt: r.closesAt,
        })),
      }),
    ]);
  }

  async setMenuPublic(branchId: string, value: boolean): Promise<void> {
    await this.prisma.branch.update({ where: { id: branchId }, data: { menuPublic: value } });
  }

  async setReservationsPublic(branchId: string, value: boolean): Promise<void> {
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { reservationsPublic: value },
    });
  }

  async setListed(branchId: string, value: boolean): Promise<void> {
    await this.prisma.branch.update({
      where: { id: branchId },
      data: { listedInConsumerApp: value },
    });
  }

  // ── reads ────────────────────────────────────────────────────────────────
  async listConsumerBranches(
    filter: ListConsumerBranchesFilter,
  ): Promise<{ items: ConsumerBranchCard[]; total: number }> {
    const where = this.buildListWhere(filter);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.branch.findMany({
        where,
        orderBy: [{ restaurant: { name: 'asc' } }, { id: 'asc' }],
        skip: filter.skip,
        take: filter.take,
        select: {
          id: true,
          restaurantId: true,
          address: true,
          city: true,
          menuPublic: true,
          reservationsPublic: true,
          restaurant: {
            select: {
              name: true,
              settings: { select: { logoUrl: true } },
              marketingPhotos: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
              attributeSelections: {
                select: {
                  value: {
                    select: { slug: true, labelHy: true, labelRu: true, labelEn: true, position: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.branch.count({ where }),
    ]);

    const items: ConsumerBranchCard[] = rows.map((b) => ({
      branchId: b.id,
      restaurantId: b.restaurantId,
      name: b.restaurant.name,
      logoUrl: b.restaurant.settings?.logoUrl ?? null,
      heroPhotoUrl: b.restaurant.marketingPhotos[0]?.url ?? null,
      address: b.address,
      city: b.city,
      menuPublic: b.menuPublic,
      reservationsPublic: b.reservationsPublic,
      attributes: summarizeAttributes(b.restaurant.attributeSelections),
    }));

    return { items, total };
  }

  async getConsumerBranchDetail(branchId: string): Promise<ConsumerBranchDetail | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, ...effectiveListingFragment() },
      select: {
        id: true,
        restaurantId: true,
        slug: true,
        address: true,
        city: true,
        publicPhone: true,
        menuPublic: true,
        reservationsPublic: true,
        publicHours: {
          select: { dayOfWeek: true, isClosed: true, opensAt: true, closesAt: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        restaurant: {
          select: {
            name: true,
            slug: true,
            timezone: true,
            aboutHy: true,
            aboutRu: true,
            aboutEn: true,
            website: true,
            settings: { select: { logoUrl: true } },
            marketingPhotos: { orderBy: { position: 'asc' } },
            attributeSelections: {
              select: {
                value: {
                  select: {
                    slug: true,
                    labelHy: true,
                    labelRu: true,
                    labelEn: true,
                    position: true,
                    category: {
                      select: {
                        slug: true,
                        labelHy: true,
                        labelRu: true,
                        labelEn: true,
                        position: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!branch) {
      return null;
    }
    const r = branch.restaurant;
    return {
      branchId: branch.id,
      restaurantId: branch.restaurantId,
      restaurantSlug: r.slug,
      branchSlug: branch.slug,
      timezone: r.timezone,
      name: r.name,
      logoUrl: r.settings?.logoUrl ?? null,
      address: branch.address,
      city: branch.city,
      publicPhone: branch.publicPhone,
      website: r.website,
      about: { hy: r.aboutHy, ru: r.aboutRu, en: r.aboutEn },
      weeklyHours: branch.publicHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
      })),
      gallery: r.marketingPhotos.map((p) => ({
        id: p.id,
        position: p.position,
        url: p.url,
        objectKey: p.objectKey,
        alt: { hy: p.altHy, ru: p.altRu, en: p.altEn },
        width: p.width,
        height: p.height,
      })),
      features: groupFeatures(r.attributeSelections),
      menuPublic: branch.menuPublic,
      reservationsPublic: branch.reservationsPublic,
    };
  }

  async loadAvailabilityContext(
    branchId: string,
  ): Promise<{ restaurantId: string; branchId: string; reservationsPublic: boolean } | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, ...effectiveListingFragment() },
      select: { id: true, restaurantId: true, reservationsPublic: true },
    });
    if (!branch) {
      return null;
    }
    return {
      restaurantId: branch.restaurantId,
      branchId: branch.id,
      reservationsPublic: branch.reservationsPublic,
    };
  }

  async loadBookingContext(branchId: string): Promise<{
    restaurantId: string;
    branchId: string;
    reservationsPublic: boolean;
    timezone: string;
    hours: PublicHoursRecord[];
  } | null> {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, ...effectiveListingFragment() },
      select: {
        id: true,
        restaurantId: true,
        reservationsPublic: true,
        publicHours: {
          select: { dayOfWeek: true, isClosed: true, opensAt: true, closesAt: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        restaurant: { select: { timezone: true } },
      },
    });
    if (!branch) {
      return null;
    }
    return {
      restaurantId: branch.restaurantId,
      branchId: branch.id,
      reservationsPublic: branch.reservationsPublic,
      timezone: branch.restaurant.timezone,
      hours: branch.publicHours.map((h) => ({
        dayOfWeek: h.dayOfWeek,
        isClosed: h.isClosed,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
      })),
    };
  }

  async getCardsByBranchIds(branchIds: string[]): Promise<ConsumerBranchCard[]> {
    const unique = [...new Set(branchIds)];
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.prisma.branch.findMany({
      where: { id: { in: unique }, ...effectiveListingFragment() },
      select: {
        id: true,
        restaurantId: true,
        address: true,
        city: true,
        menuPublic: true,
        reservationsPublic: true,
        restaurant: {
          select: {
            name: true,
            settings: { select: { logoUrl: true } },
            marketingPhotos: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
            attributeSelections: {
              select: {
                value: {
                  select: { slug: true, labelHy: true, labelRu: true, labelEn: true, position: true },
                },
              },
            },
          },
        },
      },
    });
    return rows.map((b) => ({
      branchId: b.id,
      restaurantId: b.restaurantId,
      name: b.restaurant.name,
      logoUrl: b.restaurant.settings?.logoUrl ?? null,
      heroPhotoUrl: b.restaurant.marketingPhotos[0]?.url ?? null,
      address: b.address,
      city: b.city,
      menuPublic: b.menuPublic,
      reservationsPublic: b.reservationsPublic,
      attributes: summarizeAttributes(b.restaurant.attributeSelections),
    }));
  }

  // ── where builders ─────────────────────────────────────────────────────────
  private buildListWhere(filter: ListConsumerBranchesFilter): Prisma.BranchWhereInput {
    const where: Prisma.BranchWhereInput = { ...effectiveListingFragment() };
    const and: Prisma.BranchWhereInput[] = [];

    const q = filter.q?.trim();
    if (q) {
      and.push({
        OR: [
          { address: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { restaurant: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    // AND across selected values: the restaurant must have EVERY selected value.
    // FUTURE: OR-within-category (multiple values of one category treated as OR);
    // v1 ships AND-only across all selected values.
    if (filter.attributeValueIds && filter.attributeValueIds.length > 0) {
      for (const attributeValueId of filter.attributeValueIds) {
        and.push({
          restaurant: { attributeSelections: { some: { attributeValueId } } },
        });
      }
    }

    if (and.length > 0) {
      where.AND = and;
    }
    return where;
  }
}

/**
 * Effective listing: branch.listedInConsumerApp && !restaurant.consumerListingSuppressed,
 * with the same publicly-serviceable guards the storefront uses (active + not
 * soft-deleted + org not suspended).
 */
function effectiveListingFragment(): Prisma.BranchWhereInput {
  return {
    listedInConsumerApp: true,
    status: 'ACTIVE',
    deletedAt: null,
    restaurant: {
      consumerListingSuppressed: false,
      status: 'ACTIVE',
      deletedAt: null,
      organization: { status: { not: 'SUSPENDED' }, deletedAt: null },
    },
  };
}

interface SelectedValue {
  value: {
    slug: string;
    labelHy: string;
    labelRu: string;
    labelEn: string;
    position: number;
    category?: {
      slug: string;
      labelHy: string;
      labelRu: string;
      labelEn: string;
      position: number;
    };
  };
}

function summarizeAttributes(selections: SelectedValue[]): AttributeSummaryItem[] {
  return selections
    .map((s) => s.value)
    .sort((a, b) => a.position - b.position)
    .slice(0, CARD_ATTRIBUTE_SUMMARY_LIMIT)
    .map((v) => ({ slug: v.slug, labelHy: v.labelHy, labelRu: v.labelRu, labelEn: v.labelEn }));
}

function groupFeatures(selections: SelectedValue[]): FeatureGroup[] {
  const byCategory = new Map<
    string,
    { position: number; labelHy: string; labelRu: string; labelEn: string; values: AttributeSummaryItem[] }
  >();

  for (const s of selections) {
    const v = s.value;
    const c = v.category;
    if (!c) {
      continue;
    }
    let group = byCategory.get(c.slug);
    if (!group) {
      group = {
        position: c.position,
        labelHy: c.labelHy,
        labelRu: c.labelRu,
        labelEn: c.labelEn,
        values: [],
      };
      byCategory.set(c.slug, group);
    }
    group.values.push({ slug: v.slug, labelHy: v.labelHy, labelRu: v.labelRu, labelEn: v.labelEn });
  }

  return [...byCategory.entries()]
    .sort((a, b) => a[1].position - b[1].position)
    .map(([categorySlug, g]) => ({
      categorySlug,
      labelHy: g.labelHy,
      labelRu: g.labelRu,
      labelEn: g.labelEn,
      values: g.values,
    }));
}
