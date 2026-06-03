import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ACCOUNT_QUERY, AccountQuery } from '../ports/account-query.port';
import { slugFormatReason } from '../reserved-subdomains';

export interface CheckSubdomainInput {
  slug: string;
}
export interface CheckSubdomainResult {
  available: boolean;
  reason: string | null;
}

@Injectable()
export class CheckSubdomainUseCase implements UseCase<CheckSubdomainInput, CheckSubdomainResult> {
  constructor(@Inject(ACCOUNT_QUERY) private readonly query: AccountQuery) {}

  async execute(input: CheckSubdomainInput): Promise<CheckSubdomainResult> {
    const slug = (input.slug ?? '').trim().toLowerCase();
    const formatReason = slugFormatReason(slug);
    if (formatReason) {
      return { available: false, reason: formatReason };
    }
    if (await this.query.isSlugTaken(slug)) {
      return { available: false, reason: 'This subdomain is already taken.' };
    }
    return { available: true, reason: null };
  }
}
