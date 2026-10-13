import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { ACCOUNT_QUERY, AccountQuery } from '../ports/account-query.port';

export interface CheckEmailInput {
  email: string;
}
export interface CheckEmailResult {
  available: boolean;
  reason: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class CheckEmailUseCase implements UseCase<CheckEmailInput, CheckEmailResult> {
  constructor(@Inject(ACCOUNT_QUERY) private readonly query: AccountQuery) {}

  async execute(input: CheckEmailInput): Promise<CheckEmailResult> {
    const email = (input.email ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      return { available: false, reason: 'invalid' };
    }
    if (await this.query.isEmailTaken(email)) {
      return { available: false, reason: 'taken' };
    }
    return { available: true, reason: null };
  }
}
