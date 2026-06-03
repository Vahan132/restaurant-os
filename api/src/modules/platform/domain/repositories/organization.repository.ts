import { Organization } from '../entities/organization';

export const ORGANIZATION_REPOSITORY = Symbol('OrganizationRepository');

export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
}

export interface OrganizationRestaurantView {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface OrganizationDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  subscription: {
    id: string;
    planId: string;
    planCode: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  } | null;
  restaurants: OrganizationRestaurantView[];
}

/** Platform-wide (cross-tenant) organization access. */
export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  existsBySlug(slug: string): Promise<boolean>;
  list(skip: number, take: number): Promise<{ items: OrganizationListItem[]; total: number }>;
  getDetail(id: string): Promise<OrganizationDetail | null>;
  /** Persist status changes (suspend/activate). */
  update(organization: Organization): Promise<void>;
}
