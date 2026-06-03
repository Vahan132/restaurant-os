import { AggregateRoot } from '../../../../shared/domain/aggregate-root';

export enum RestaurantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface RestaurantProps {
  organizationId: string;
  name: string;
  slug: string;
  currency: string;
  defaultLanguage: string;
  timezone: string;
  status: RestaurantStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Restaurant aggregate (tenant-scoped operations root). */
export class Restaurant extends AggregateRoot<string> {
  private props: RestaurantProps;

  private constructor(id: string, props: RestaurantProps) {
    super(id);
    this.props = props;
  }

  static reconstitute(id: string, props: RestaurantProps): Restaurant {
    return new Restaurant(id, props);
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get slug(): string {
    return this.props.slug;
  }
  get currency(): string {
    return this.props.currency;
  }
  get defaultLanguage(): string {
    return this.props.defaultLanguage;
  }
  get timezone(): string {
    return this.props.timezone;
  }
  get status(): RestaurantStatus {
    return this.props.status;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateProfile(input: {
    name?: string;
    currency?: string;
    defaultLanguage?: string;
    timezone?: string;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.currency !== undefined) this.props.currency = input.currency;
    if (input.defaultLanguage !== undefined) this.props.defaultLanguage = input.defaultLanguage;
    if (input.timezone !== undefined) this.props.timezone = input.timezone;
    this.props.updatedAt = new Date();
  }
}
