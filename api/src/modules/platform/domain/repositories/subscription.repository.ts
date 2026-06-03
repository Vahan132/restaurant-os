import { Subscription } from '../entities/subscription';

export const SUBSCRIPTION_REPOSITORY = Symbol('SubscriptionRepository');

export interface SubscriptionRepository {
  findByOrganizationId(organizationId: string): Promise<Subscription | null>;
  update(subscription: Subscription): Promise<void>;
}
