import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
  PublicHoursRecord,
} from '../../domain/repositories/branch-public.repository';
import { BranchNotListedError } from '../../domain/consumer.errors';
import {
  ConsumerBranchDetailResponse,
  PublicHoursResponse,
} from '../dto/responses';

export interface GetConsumerBranchDetailInput {
  branchId: string;
}

/**
 * GetConsumerBranchDetail — full detail for an effectively-listed branch. 404
 * BRANCH_NOT_LISTED otherwise. Includes today's hours (branch-local), full weekly
 * hours, gallery, Features (grouped), and the public menu link only if menuPublic.
 * Anonymous.
 */
@Injectable()
export class GetConsumerBranchDetailUseCase
  implements UseCase<GetConsumerBranchDetailInput, ConsumerBranchDetailResponse>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
  ) {}

  async execute(input: GetConsumerBranchDetailInput): Promise<ConsumerBranchDetailResponse> {
    const detail = await this.branches.getConsumerBranchDetail(input.branchId);
    if (!detail) {
      throw new BranchNotListedError();
    }

    const weeklyHours = detail.weeklyHours.map(toHoursResponse);
    const todayIndex = mondayZeroDayOfWeek(detail.timezone);
    const todayHours = weeklyHours.find((h) => h.dayOfWeek === todayIndex) ?? null;

    // Reuse the existing storefront menu path (branch-explicit), only when public.
    const menuUrl = detail.menuPublic
      ? `/public/${detail.restaurantSlug}/branch/${detail.branchSlug}/menu`
      : null;

    return {
      branchId: detail.branchId,
      restaurantId: detail.restaurantId,
      name: detail.name,
      logoUrl: detail.logoUrl,
      address: detail.address,
      city: detail.city,
      publicPhone: detail.publicPhone,
      website: detail.website,
      about: { hy: detail.about.hy ?? null, ru: detail.about.ru ?? null, en: detail.about.en ?? null },
      todayHours,
      weeklyHours,
      gallery: detail.gallery.map((p) => ({
        id: p.id,
        position: p.position,
        url: p.url,
        alt: { hy: p.alt.hy ?? null, ru: p.alt.ru ?? null, en: p.alt.en ?? null },
        width: p.width,
        height: p.height,
      })),
      features: detail.features.map((g) => ({
        categorySlug: g.categorySlug,
        labelHy: g.labelHy,
        labelRu: g.labelRu,
        labelEn: g.labelEn,
        values: g.values,
      })),
      menuPublic: detail.menuPublic,
      reservationsPublic: detail.reservationsPublic,
      menuUrl,
    };
  }
}

function toHoursResponse(r: PublicHoursRecord): PublicHoursResponse {
  const crossesMidnight =
    !r.isClosed && r.opensAt !== null && r.closesAt !== null && r.closesAt < r.opensAt;
  return {
    dayOfWeek: r.dayOfWeek,
    isClosed: r.isClosed,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
    crossesMidnight,
  };
}

/** Current weekday in the given IANA timezone as 0=Mon … 6=Sun. */
function mondayZeroDayOfWeek(timeZone: string): number {
  let weekday: string;
  try {
    weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(new Date());
  } catch {
    weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date());
  }
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekday] ?? 0;
}
