import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';
import { PublicHoursRow, PublicHoursRowInput } from '../../domain/value-objects/public-hours';

export interface SetBranchPublicHoursInput {
  branchId: string;
  rows: PublicHoursRowInput[];
}

/**
 * SetBranchPublicHours — upsert the weekly schedule. Each row is validated by the
 * PublicHoursRow value object (HH:mm well-formed; open rows require both times;
 * cross-midnight allowed). Replaces the branch's existing rows.
 */
@Injectable()
export class SetBranchPublicHoursUseCase implements UseCase<SetBranchPublicHoursInput, void> {
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
  ) {}

  async execute(input: SetBranchPublicHoursInput): Promise<void> {
    const rows = input.rows.map((r) => {
      const vo = PublicHoursRow.create(r);
      return {
        dayOfWeek: vo.dayOfWeek,
        isClosed: vo.isClosed,
        opensAt: vo.opensAt,
        closesAt: vo.closesAt,
      };
    });
    await this.branches.setPublicHours(input.branchId, rows);
  }
}
