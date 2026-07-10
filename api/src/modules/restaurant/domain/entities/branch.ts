import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { OrderingConfig } from '../value-objects/ordering-config';

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/** 3A: per-branch IP binding policy for device-anchored logins. */
export enum BranchIpBindingMode {
  STRICT = 'STRICT',
  SOFT = 'SOFT',
}

export interface BranchProps {
  restaurantId: string;
  name: string;
  /** BR-9: public-facing, per-restaurant unique slug. */
  slug: string;
  isDefault: boolean;
  status: BranchStatus;
  /** 3A: STRICT enforces ipAllowlist; SOFT records + trusts the seen IP. */
  ipBindingMode: BranchIpBindingMode;
  /** 3A: manager-editable CIDRs evaluated under STRICT. */
  ipAllowlist: string[];
  /** ORDER-1: per-branch ordering flow policy (narrows the restaurant ceiling). */
  orderingConfig: OrderingConfig;
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
      ipBindingMode: BranchIpBindingMode.SOFT,
      ipAllowlist: [],
      orderingConfig: OrderingConfig.default(),
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
  get ipBindingMode(): BranchIpBindingMode {
    return this.props.ipBindingMode;
  }
  get ipAllowlist(): string[] {
    return this.props.ipAllowlist;
  }
  /** ORDER-1: per-branch ordering flow policy. */
  get orderingConfig(): OrderingConfig {
    return this.props.orderingConfig;
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

  /**
   * 3A: set the branch IP policy. Returns true if anything actually changed (so
   * the use case can audit only real changes). Allowlist is de-duplicated.
   */
  updateIpPolicy(mode?: BranchIpBindingMode, allowlist?: string[]): boolean {
    let changed = false;
    if (mode !== undefined && mode !== this.props.ipBindingMode) {
      this.props.ipBindingMode = mode;
      changed = true;
    }
    if (allowlist !== undefined) {
      const next = Array.from(new Set(allowlist.map((c) => c.trim()).filter((c) => c.length > 0)));
      const prev = this.props.ipAllowlist;
      const differs = next.length !== prev.length || next.some((c, i) => c !== prev[i]);
      if (differs) {
        this.props.ipAllowlist = next;
        changed = true;
      }
    }
    if (changed) {
      this.touch();
    }
    return changed;
  }

  /**
   * ORDER-1: replace the branch ordering config. The VO validates its own
   * invariants (≥1 flow when ordering on, qrOrdering ⇒ prepayment, idle bounds).
   * Returns true if anything actually changed (so the use case can audit real
   * changes only). The restaurant ceiling is applied separately at session start.
   */
  updateOrderingConfig(config: OrderingConfig): boolean {
    if (this.props.orderingConfig.equals(config)) {
      return false;
    }
    this.props.orderingConfig = config;
    this.touch();
    return true;
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
