import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { Organization } from '../../domain/entities/organization';
import {
  ORGANIZATION_REPOSITORY,
  OrganizationRepository,
} from '../../domain/repositories/organization.repository';
import { OrganizationNotFound } from '../application.errors';

/** Re-activate a suspended organization. */
@Injectable()
export class ActivateOrganizationUseCase implements UseCase<
  { organizationId: string },
  Organization
> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
  ) {}

  async execute(input: { organizationId: string }): Promise<Organization> {
    const org = await this.organizations.findById(input.organizationId);
    if (!org) {
      throw OrganizationNotFound();
    }
    org.activate();
    await this.organizations.update(org);
    return org;
  }
}
