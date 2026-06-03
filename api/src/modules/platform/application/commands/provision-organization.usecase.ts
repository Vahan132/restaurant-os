import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { UseCase } from '../../../../shared/application/use-case';
import { DomainEventPublisher } from '../../../../shared/infrastructure/events/domain-event-publisher';
import { ID_GENERATOR, IdGenerator } from '../../../identity/application/ports/id-generator';
import {
  SystemRoleSeeder,
  OWNER_ROLE_CODE,
} from '../../../identity/application/services/system-role-seeder';
import { UserFactory } from '../../../identity/application/services/user-factory';
import { OrganizationProvisionedEvent } from '../../domain/events/platform-events';
import {
  ORGANIZATION_REPOSITORY,
  OrganizationRepository,
} from '../../domain/repositories/organization.repository';
import { PLAN_REPOSITORY, PlanRepository } from '../../domain/repositories/plan.repository';
import {
  ORGANIZATION_PROVISIONING_REPOSITORY,
  OrganizationProvisioningRepository,
} from '../../domain/repositories/provisioning.repository';
import { OrganizationSlugAlreadyExists, PlanNotFound } from '../application.errors';
import { SubscriptionHistoryAppender } from '../services/subscription-history-appender';

export interface ProvisionOrganizationInput {
  org: { name: string; slug: string };
  planCode: string;
  restaurant: {
    name: string;
    slug: string;
    currency: string;
    defaultLanguage?: string;
    timezone?: string;
  };
  owner: { fullName: string; email: string; password?: string };
  actorUserId?: string | null;
}

export interface ProvisionOrganizationOutput {
  organizationId: string;
  restaurantId: string;
  ownerUserId: string;
  ownerEmail: string;
  /** The owner's password — returned ONCE (generated if not supplied). */
  ownerPassword: string;
  passwordGenerated: boolean;
}

const TRIAL_DAYS = 14;

/**
 * Provision a brand-new account in ONE transaction: organization + subscription
 * (TRIALING, 14d) + restaurant + settings + the 6 system roles + owner user.
 * Reuses identity's SystemRoleSeeder + UserFactory. Emits OrganizationProvisioned.
 */
@Injectable()
export class ProvisionOrganizationUseCase implements UseCase<
  ProvisionOrganizationInput,
  ProvisionOrganizationOutput
> {
  constructor(
    @Inject(PLAN_REPOSITORY) private readonly plans: PlanRepository,
    @Inject(ORGANIZATION_REPOSITORY) private readonly organizations: OrganizationRepository,
    @Inject(ORGANIZATION_PROVISIONING_REPOSITORY)
    private readonly provisioning: OrganizationProvisioningRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly roleSeeder: SystemRoleSeeder,
    private readonly userFactory: UserFactory,
    private readonly history: SubscriptionHistoryAppender,
    private readonly events: DomainEventPublisher,
  ) {}

  async execute(input: ProvisionOrganizationInput): Promise<ProvisionOrganizationOutput> {
    const plan = await this.plans.findByCode(input.planCode);
    if (!plan || !plan.isActive) {
      throw PlanNotFound();
    }
    if (await this.organizations.existsBySlug(input.org.slug)) {
      throw OrganizationSlugAlreadyExists();
    }

    const organizationId = this.ids.generate();
    const restaurantId = this.ids.generate();
    const subscriptionId = this.ids.generate();
    const settingsId = this.ids.generate();

    // Reuse identity's role-seeding (single source of truth = catalog).
    const roles = this.roleSeeder.build(organizationId);
    const ownerRole = roles.find((r) => r.code === OWNER_ROLE_CODE);
    if (!ownerRole) {
      // Defensive: the catalog always contains OWNER.
      throw new Error('OWNER system role missing from catalog.');
    }

    // Generate a password if none provided (returned once).
    const passwordGenerated = !input.owner.password;
    const ownerPassword = input.owner.password ?? this.generatePassword();

    // Reuse identity's user-creation (validation + hashing). Built outside the
    // DB transaction; only the precomputed hash is inserted within it.
    const ownerUser = await this.userFactory.build({
      organizationId,
      email: input.owner.email,
      password: ownerPassword,
      fullName: input.owner.fullName,
      roleId: ownerRole.id,
      restaurantId,
    });

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.provisioning.provision({
      maxRestaurants: plan.features.maxRestaurants,
      organization: { id: organizationId, name: input.org.name, slug: input.org.slug },
      subscription: {
        id: subscriptionId,
        planId: plan.id,
        status: 'TRIALING',
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
      },
      restaurant: {
        id: restaurantId,
        name: input.restaurant.name,
        slug: input.restaurant.slug,
        currency: input.restaurant.currency,
        defaultLanguage: input.restaurant.defaultLanguage ?? 'en',
        timezone: input.restaurant.timezone ?? 'UTC',
      },
      settings: { id: settingsId },
      roles,
      owner: {
        id: ownerUser.id,
        organizationId,
        restaurantId,
        email: ownerUser.email.value,
        passwordHash: ownerUser.passwordHash.value,
        fullName: ownerUser.fullName,
        roleId: ownerRole.id,
      },
    });

    await this.history.append({
      organizationId: result.organizationId,
      subscriptionId,
      toStatus: 'TRIALING',
      toPlanId: plan.id,
      changedByType: input.actorUserId ? 'PLATFORM_USER' : 'SYSTEM',
      changedByUserId: input.actorUserId ?? null,
      reason: 'created',
    });

    await this.events.publish(
      new OrganizationProvisionedEvent(
        result.organizationId,
        result.restaurantId,
        result.ownerUserId,
        plan.code,
        input.actorUserId ?? null,
      ),
    );

    return {
      organizationId: result.organizationId,
      restaurantId: result.restaurantId,
      ownerUserId: result.ownerUserId,
      ownerEmail: ownerUser.email.value,
      ownerPassword,
      passwordGenerated,
    };
  }

  /** Random password that satisfies RawPassword strength (letters + digits). */
  private generatePassword(): string {
    return `Px${randomBytes(9).toString('hex')}9`;
  }
}
