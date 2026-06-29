import { AggregateRoot } from '../../../../shared/domain/aggregate-root';

export interface DishModifierGroupProps {
  restaurantId: string;
  branchId: string;
  menuItemId: string;
  modifierGroupId: string;
  requiredOverride: boolean | null;
  minOverride: number | null;
  maxOverride: number | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDishModifierGroupInput {
  id: string;
  restaurantId: string;
  branchId: string;
  menuItemId: string;
  modifierGroupId: string;
  requiredOverride?: boolean | null;
  minOverride?: number | null;
  maxOverride?: number | null;
  sortOrder?: number;
}

/**
 * DishModifierGroup — the dish↔group attachment (Prompt 1A). Carries optional
 * per-attachment overrides; a null override inherits the group value. Effective
 * rules are resolved via `../modifier-rules.ts`. The attachment holds no order
 * history, so detaching hard-deletes it.
 */
export class DishModifierGroup extends AggregateRoot<string> {
  private props: DishModifierGroupProps;

  private constructor(id: string, props: DishModifierGroupProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateDishModifierGroupInput): DishModifierGroup {
    const now = new Date();
    return new DishModifierGroup(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      menuItemId: input.menuItemId,
      modifierGroupId: input.modifierGroupId,
      requiredOverride: input.requiredOverride ?? null,
      minOverride: input.minOverride ?? null,
      maxOverride: input.maxOverride ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: DishModifierGroupProps): DishModifierGroup {
    return new DishModifierGroup(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get menuItemId(): string {
    return this.props.menuItemId;
  }
  get modifierGroupId(): string {
    return this.props.modifierGroupId;
  }
  get requiredOverride(): boolean | null {
    return this.props.requiredOverride;
  }
  get minOverride(): number | null {
    return this.props.minOverride;
  }
  get maxOverride(): number | null {
    return this.props.maxOverride;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
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

  setSortOrder(sortOrder: number): void {
    this.props.sortOrder = sortOrder;
    this.touch();
  }

  /**
   * Apply overrides. `undefined` leaves a field unchanged; an explicit `null`
   * clears the override (reverting to the group's own value).
   */
  setOverrides(input: {
    requiredOverride?: boolean | null;
    minOverride?: number | null;
    maxOverride?: number | null;
    sortOrder?: number;
  }): void {
    if (input.requiredOverride !== undefined) this.props.requiredOverride = input.requiredOverride;
    if (input.minOverride !== undefined) this.props.minOverride = input.minOverride;
    if (input.maxOverride !== undefined) this.props.maxOverride = input.maxOverride;
    if (input.sortOrder !== undefined) this.props.sortOrder = input.sortOrder;
    this.touch();
  }
}
