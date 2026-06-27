import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ModifierSelectionType } from '../enums';
import { InvalidModifierSelectionError } from '../menu.errors';

export interface ModifierGroupProps {
  restaurantId: string;
  branchId: string;
  menuItemId: string;
  name: string;
  selectionType: ModifierSelectionType;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateModifierGroupInput {
  id: string;
  restaurantId: string;
  branchId: string;
  menuItemId: string;
  name: string;
  selectionType: ModifierSelectionType;
  required?: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
  displayOrder?: number;
}

/**
 * ModifierGroup aggregate (per-item; no shared/reusable groups).
 * Invariants:
 *  - SINGLE: pick exactly one when required (min=1,max=1), else (min=0,max=1).
 *  - MULTIPLE: minSelect <= maxSelect (when set); maxSelect <= option count (checked
 *    by the use case via assertConsistentWithOptionCount once options are known).
 */
export class ModifierGroup extends AggregateRoot<string> {
  private props: ModifierGroupProps;

  private constructor(id: string, props: ModifierGroupProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateModifierGroupInput): ModifierGroup {
    const now = new Date();
    const normalized = ModifierGroup.normalize(
      input.selectionType,
      input.required ?? false,
      input.minSelect ?? null,
      input.maxSelect ?? null,
    );
    return new ModifierGroup(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      menuItemId: input.menuItemId,
      name: input.name,
      selectionType: input.selectionType,
      required: input.required ?? false,
      minSelect: normalized.minSelect,
      maxSelect: normalized.maxSelect,
      displayOrder: input.displayOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: ModifierGroupProps): ModifierGroup {
    return new ModifierGroup(id, props);
  }

  private static normalize(
    selectionType: ModifierSelectionType,
    required: boolean,
    minSelect: number | null,
    maxSelect: number | null,
  ): { minSelect: number | null; maxSelect: number | null } {
    if (selectionType === ModifierSelectionType.SINGLE) {
      // Single = pick exactly one (required) or at most one.
      return { minSelect: required ? 1 : 0, maxSelect: 1 };
    }
    // MULTIPLE
    const min = minSelect ?? (required ? 1 : 0);
    const max = maxSelect ?? null;
    if (min < 0) {
      throw new InvalidModifierSelectionError('minSelect must be >= 0.');
    }
    if (max !== null && max < 1) {
      throw new InvalidModifierSelectionError('maxSelect must be >= 1.');
    }
    if (max !== null && min > max) {
      throw new InvalidModifierSelectionError('minSelect must be <= maxSelect.');
    }
    return { minSelect: min, maxSelect: max };
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
  get name(): string {
    return this.props.name;
  }
  get selectionType(): ModifierSelectionType {
    return this.props.selectionType;
  }
  get required(): boolean {
    return this.props.required;
  }
  get minSelect(): number | null {
    return this.props.minSelect;
  }
  get maxSelect(): number | null {
    return this.props.maxSelect;
  }
  get displayOrder(): number {
    return this.props.displayOrder;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  update(input: {
    name?: string;
    selectionType?: ModifierSelectionType;
    required?: boolean;
    minSelect?: number | null;
    maxSelect?: number | null;
    displayOrder?: number;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.displayOrder !== undefined) this.props.displayOrder = input.displayOrder;
    if (input.selectionType !== undefined) this.props.selectionType = input.selectionType;
    if (input.required !== undefined) this.props.required = input.required;

    const normalized = ModifierGroup.normalize(
      this.props.selectionType,
      this.props.required,
      input.minSelect !== undefined ? input.minSelect : this.props.minSelect,
      input.maxSelect !== undefined ? input.maxSelect : this.props.maxSelect,
    );
    this.props.minSelect = normalized.minSelect;
    this.props.maxSelect = normalized.maxSelect;
    this.touch();
  }

  /** maxSelect cannot exceed the number of options (when a cap is set). */
  assertConsistentWithOptionCount(optionCount: number): void {
    if (this.props.maxSelect !== null && this.props.maxSelect > optionCount) {
      throw new InvalidModifierSelectionError(
        `maxSelect (${this.props.maxSelect}) cannot exceed the number of options (${optionCount}).`,
      );
    }
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.touch();
  }
}
