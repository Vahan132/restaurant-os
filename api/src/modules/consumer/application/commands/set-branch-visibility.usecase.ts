import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';

export interface SetBranchFlagInput {
  branchId: string;
  value: boolean;
}

/** SetBranchMenuPublic — toggle menuPublic independently. */
@Injectable()
export class SetBranchMenuPublicUseCase implements UseCase<SetBranchFlagInput, void> {
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
  ) {}

  async execute(input: SetBranchFlagInput): Promise<void> {
    await this.branches.setMenuPublic(input.branchId, input.value);
  }
}

/** SetBranchReservationsPublic — toggle reservationsPublic independently. */
@Injectable()
export class SetBranchReservationsPublicUseCase implements UseCase<SetBranchFlagInput, void> {
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
  ) {}

  async execute(input: SetBranchFlagInput): Promise<void> {
    await this.branches.setReservationsPublic(input.branchId, input.value);
  }
}
