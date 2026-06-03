import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import {
  ORGANIZATION_REPOSITORY,
  OrganizationDetail,
  OrganizationRepository,
} from '../../domain/repositories/organization.repository';
import { OrganizationNotFound } from '../application.errors';

/** Fetch one organization with its restaurants + subscription. */
@Injectable()
export class GetOrganizationUseCase implements UseCase<
  { organizationId: string },
  OrganizationDetail
> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
  ) {}

  async execute(input: { organizationId: string }): Promise<OrganizationDetail> {
    const detail = await this.organizations.getDetail(input.organizationId);
    if (!detail) {
      throw OrganizationNotFound();
    }
    return detail;
  }
}
