import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { OrganizationSuspendedEvent } from '../events/platform-events';

export enum OrganizationStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface OrganizationProps {
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Organization aggregate (platform view) — billing/account root. */
export class Organization extends AggregateRoot<string> {
  private props: OrganizationProps;

  private constructor(id: string, props: OrganizationProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: OrganizationProps): Organization {
    return new Organization(id, props);
  }

  get name(): string {
    return this.props.name;
  }
  get slug(): string {
    return this.props.slug;
  }
  get status(): OrganizationStatus {
    return this.props.status;
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

  suspend(actorUserId: string | null = null): void {
    if (this.props.status !== OrganizationStatus.SUSPENDED) {
      this.props.status = OrganizationStatus.SUSPENDED;
      this.touch();
      this.addDomainEvent(new OrganizationSuspendedEvent(this.id, actorUserId));
    }
  }

  activate(): void {
    if (this.props.status !== OrganizationStatus.ACTIVE) {
      this.props.status = OrganizationStatus.ACTIVE;
      this.touch();
    }
  }
}
