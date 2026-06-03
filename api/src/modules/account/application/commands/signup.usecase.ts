import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { LoginUseCase } from '../../../identity/application/commands/login.usecase';
import { ProvisionOrganizationUseCase } from '../../../platform/application/commands/provision-organization.usecase';
import { ACCOUNT_QUERY, AccountQuery } from '../ports/account-query.port';
import { slugFormatReason } from '../reserved-subdomains';
import { User } from '../../../identity/domain/entities/user';

export interface SignupInput {
  ownerName: string;
  email: string;
  password: string;
  businessName: string;
  planCode: string;
  restaurantName: string;
  slug: string;
  currency?: string;
  defaultLanguage?: string;
  timezone?: string;
}
export interface SignupResult {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * Self-serve signup: validate slug, provision a full account (org + TRIALING
 * subscription + restaurant + owner via the platform ProvisionOrganization),
 * then AUTO-LOGIN the owner (same output as /auth/login).
 */
@Injectable()
export class SignupUseCase implements UseCase<SignupInput, SignupResult> {
  constructor(
    private readonly provision: ProvisionOrganizationUseCase,
    private readonly login: LoginUseCase,
    @Inject(ACCOUNT_QUERY) private readonly query: AccountQuery,
  ) {}

  async execute(input: SignupInput): Promise<SignupResult> {
    const slug = input.slug.trim().toLowerCase();
    const formatReason = slugFormatReason(slug);
    if (formatReason) {
      throw new BadRequestException({ code: 'INVALID_SLUG', message: formatReason });
    }
    if (await this.query.isSlugTaken(slug)) {
      throw new ConflictException({
        code: 'SLUG_TAKEN',
        message: 'This subdomain is already taken.',
      });
    }

    // ProvisionOrganization validates plan exists+active and org-slug uniqueness,
    // creates everything in one transaction, and appends "created" history.
    const result = await this.provision.execute({
      org: { name: input.businessName, slug },
      planCode: input.planCode,
      restaurant: {
        name: input.restaurantName,
        slug,
        currency: input.currency ?? 'USD',
        defaultLanguage: input.defaultLanguage,
        timezone: input.timezone,
      },
      owner: { fullName: input.ownerName, email: input.email, password: input.password },
      // actorUserId omitted -> history records changedByType SYSTEM (self-serve).
    });

    // Auto-login the brand-new owner (TRIALING is good standing).
    const tokens = await this.login.execute({
      email: result.ownerEmail,
      password: input.password,
      organizationId: result.organizationId,
    });
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    };
  }
}
