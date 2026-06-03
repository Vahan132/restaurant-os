import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { SubscriptionStatusChangedEvent } from '../events/platform-events';

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  SUSPENDED = 'SUSPENDED',
}

export interface SubscriptionProps {
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Subscription aggregate — one per organization. */
export class Subscription extends AggregateRoot<string> {
  private props: SubscriptionProps;

  private constructor(id: string, props: SubscriptionProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: SubscriptionProps): Subscription {
    return new Subscription(id, props);
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get planId(): string {
    return this.props.planId;
  }
  get status(): SubscriptionStatus {
    return this.props.status;
  }
  get trialEndsAt(): Date | null {
    return this.props.trialEndsAt;
  }
  get currentPeriodStart(): Date | null {
    return this.props.currentPeriodStart;
  }
  get currentPeriodEnd(): Date | null {
    return this.props.currentPeriodEnd;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  changePlan(planId: string): void {
    this.props.planId = planId;
    this.touch();
  }

  setStatus(status: SubscriptionStatus): void {
    this.props.status = status;
    this.touch();
    this.addDomainEvent(new SubscriptionStatusChangedEvent(this.organizationId, this.id, status));
  }
}
