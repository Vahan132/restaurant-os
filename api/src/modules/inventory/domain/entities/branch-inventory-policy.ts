import { Entity } from '../../../../shared/domain/entity';
import { NegativeStockMode } from '../enums';

export interface BranchInventoryPolicyProps {
  restaurantId: string;
  branchId: string;
  negativeStockMode: NegativeStockMode;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * BranchInventoryPolicy — one row per branch (6A). Governs depletion behavior
 * when on-hand would go below zero. Default WARN. BLOCK applies to manual/admin
 * depletions only; the POS-serve exception is enforced in 6C.
 */
export class BranchInventoryPolicy extends Entity<string> {
  private props: BranchInventoryPolicyProps;

  private constructor(id: string, props: BranchInventoryPolicyProps) {
    super(id);
    this.props = props;
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    negativeStockMode?: NegativeStockMode;
  }): BranchInventoryPolicy {
    const now = new Date();
    return new BranchInventoryPolicy(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      negativeStockMode: input.negativeStockMode ?? NegativeStockMode.WARN,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: BranchInventoryPolicyProps): BranchInventoryPolicy {
    return new BranchInventoryPolicy(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get negativeStockMode(): NegativeStockMode {
    return this.props.negativeStockMode;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  setMode(mode: NegativeStockMode): void {
    this.props.negativeStockMode = mode;
    this.props.updatedAt = new Date();
  }
}
