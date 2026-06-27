import { AggregateRoot } from '../../../../shared/domain/aggregate-root';

export interface BranchMembershipProps {
  restaurantId: string;
  branchId: string;
  userId: string;
  roleId: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchMembershipInput {
  id: string;
  restaurantId: string;
  branchId: string;
  userId: string;
  roleId: string;
  createdByUserId: string;
}

/**
 * BranchMembership (BR-1): a user's role at a SPECIFIC branch. One role per user
 * per branch (enforced by a unique constraint on (branchId, userId)). Branch-
 * scoped users derive all of their access from these.
 */
export class BranchMembership extends AggregateRoot<string> {
  private props: BranchMembershipProps;

  private constructor(id: string, props: BranchMembershipProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateBranchMembershipInput): BranchMembership {
    const now = new Date();
    return new BranchMembership(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      userId: input.userId,
      roleId: input.roleId,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: BranchMembershipProps): BranchMembership {
    return new BranchMembership(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get roleId(): string {
    return this.props.roleId;
  }
  get createdByUserId(): string {
    return this.props.createdByUserId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Reassign the role this membership grants at its branch. */
  changeRole(roleId: string): void {
    this.props.roleId = roleId;
    this.props.updatedAt = new Date();
  }
}
