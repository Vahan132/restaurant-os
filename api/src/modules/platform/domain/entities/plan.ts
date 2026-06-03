import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { InvalidPriceError } from '../platform.errors';

export enum PlanInterval {
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export interface PlanFeatures {
  maxRestaurants: number;
  maxBranchesPerRestaurant: number;
  maxUsers: number;
  enabledModules: string[];
}

export interface PlanProps {
  code: string;
  name: string;
  priceAmount: number; // integer minor units
  currency: string;
  interval: PlanInterval;
  features: PlanFeatures;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlanInput {
  id: string;
  code: string;
  name: string;
  priceAmount: number;
  currency: string;
  interval: PlanInterval;
  features: PlanFeatures;
}

/** Plan aggregate — a subscription tier (price in minor units, no floats). */
export class Plan extends AggregateRoot<string> {
  private props: PlanProps;

  private constructor(id: string, props: PlanProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreatePlanInput): Plan {
    Plan.assertValidPrice(input.priceAmount);
    const now = new Date();
    return new Plan(input.id, {
      code: input.code,
      name: input.name,
      priceAmount: input.priceAmount,
      currency: input.currency,
      interval: input.interval,
      features: input.features,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: PlanProps): Plan {
    return new Plan(id, props);
  }

  private static assertValidPrice(price: number): void {
    if (!Number.isInteger(price) || price < 0) {
      throw new InvalidPriceError();
    }
  }

  get code(): string {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get priceAmount(): number {
    return this.props.priceAmount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get interval(): PlanInterval {
    return this.props.interval;
  }
  get features(): PlanFeatures {
    return this.props.features;
  }
  get isActive(): boolean {
    return this.props.isActive;
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

  update(input: {
    name?: string;
    priceAmount?: number;
    currency?: string;
    interval?: PlanInterval;
    features?: PlanFeatures;
  }): void {
    if (input.priceAmount !== undefined) {
      Plan.assertValidPrice(input.priceAmount);
      this.props.priceAmount = input.priceAmount;
    }
    if (input.name !== undefined) this.props.name = input.name;
    if (input.currency !== undefined) this.props.currency = input.currency;
    if (input.interval !== undefined) this.props.interval = input.interval;
    if (input.features !== undefined) this.props.features = input.features;
    this.touch();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }
}
