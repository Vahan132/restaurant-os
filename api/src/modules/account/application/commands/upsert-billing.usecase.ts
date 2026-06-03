import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import { BILLING_REPOSITORY, BillingInfo, BillingRepository } from '../ports/billing.repository';

export interface UpsertBillingInput {
  organizationId: string;
  billingName?: string | null;
  billingEmail?: string | null;
  billingAddress?: string | null;
  taxId?: string | null;
}

@Injectable()
export class UpsertBillingUseCase implements UseCase<UpsertBillingInput, BillingInfo> {
  constructor(
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  execute(input: UpsertBillingInput): Promise<BillingInfo> {
    return this.billing.upsert({ id: this.ids.generate(), ...input });
  }
}
