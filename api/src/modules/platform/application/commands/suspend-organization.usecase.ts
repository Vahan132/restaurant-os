import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { Organization } from '../../domain/entities/organization';
import {
  ORGANIZATION_REPOSITORY,
  OrganizationRepository,
} from '../../domain/repositories/organization.repository';
import { OrganizationNotFound } from '../application.errors';

/** Suspend an organization (blocks its users at next login/refresh). */
@Injectable()
export class SuspendOrganizationUseCase implements UseCase<
  { organizationId: string; actorUserId?: string | null },
  Organization
> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: {
    organizationId: string;
    actorUserId?: string | null;
  }): Promise<Organization> {
    const org = await this.organizations.findById(input.organizationId);
    if (!org) {
      throw OrganizationNotFound();
    }
    org.suspend(input.actorUserId ?? null);
    await this.organizations.update(org);
    await this.events.publishFromAggregate(org);
    return org;
  }
}
