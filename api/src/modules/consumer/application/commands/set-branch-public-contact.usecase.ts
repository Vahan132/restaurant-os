import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  BRANCH_PUBLIC_REPOSITORY,
  BranchPublicRepository,
} from '../../domain/repositories/branch-public.repository';

export interface SetBranchPublicContactInput {
  branchId: string;
  publicPhone?: string | null;
  // Branch-owned location (added in CX-1: operational address is restaurant-scoped
  // on RestaurantSettings, so the consumer listing unit carries its own).
  address?: string | null;
  city?: string | null;
}

/** SetBranchPublicContact — set the branch's public phone + location. */
@Injectable()
export class SetBranchPublicContactUseCase
  implements UseCase<SetBranchPublicContactInput, void>
{
  constructor(
    @Inject(BRANCH_PUBLIC_REPOSITORY)
    private readonly branches: BranchPublicRepository,
  ) {}

  async execute(input: SetBranchPublicContactInput): Promise<void> {
    await this.branches.setPublicContact(input.branchId, {
      publicPhone: input.publicPhone ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
    });
  }
}
