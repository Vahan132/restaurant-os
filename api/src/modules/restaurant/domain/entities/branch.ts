import { AggregateRoot } from '../../../../shared/domain/aggregate-root';

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface BranchProps {
  restaurantId: string;
  name: string;
  /** BR-9: public-facing, per-restaurant unique slug. */
  slug: string;
  isDefault: boolean;
  status: BranchStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateBranchInput {
  id: string;
  restaurantId: string;
  name: string;
  slug: string;
  isDefault?: boolean;
}

/** Branch aggregate (location within a restaurant). */
export class Branch extends AggregateRoot<string> {
  private props: BranchProps;

  private constructor(id: string, props: BranchProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateBranchInput): Branch {
    const now = new Date();
    return new Branch(input.id, {
      restaurantId: input.restaurantId,
      name: input.name,
      slug: input.slug,
      isDefault: input.isDefault ?? false,
      status: BranchStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: BranchProps): Branch {
    return new Branch(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get name(): string {
    return this.props.name;
  }
  /** BR-9: public-facing, per-restaurant unique slug. */
  get slug(): string {
    return this.props.slug;
  }
  get isDefault(): boolean {
    return this.props.isDefault;
  }
  get status(): BranchStatus {
    return this.props.status;
  }

  isActive(): boolean {
    return this.props.status === BranchStatus.ACTIVE && this.props.deletedAt === null;
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

  rename(name: string): void {
    this.props.name = name;
    this.touch();
  }

  activate(): void {
    this.props.status = BranchStatus.ACTIVE;
    this.touch();
  }

  deactivate(): void {
    this.props.status = BranchStatus.INACTIVE;
    this.touch();
  }
}
