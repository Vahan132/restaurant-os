import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { I18nText } from '../../../../shared/i18n/i18n-text';
import { MenuStatus, ModifierSelectionType } from '../enums';
import { InvalidModifierSelectionError } from '../menu.errors';

export interface ModifierGroupProps {
  restaurantId: string;
  branchId: string;
  name: string;
  /** LOCALE-2A: nullable hy/ru/en translations of the name. */
  nameHy: string | null;
  nameRu: string | null;
  nameEn: string | null;
  selectionType: ModifierSelectionType;
  required: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateModifierGroupInput {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  selectionType: ModifierSelectionType;
  required?: boolean;
  minSelect?: number | null;
  maxSelect?: number | null;
}

/**
 * ModifierGroup aggregate — a reusable, restaurant+branch-scoped library entity
 * (Prompt 1A). No longer owned by a dish; attached many-to-many via
 * DishModifierGroup. Per-attachment overrides + effective-rule resolution live in
 * `../modifier-rules.ts`.
 *
 * Base invariants (the group's own rules, before any attachment override):
 *  - SINGLE: pick exactly one when required (min=1,max=1), else (min=0,max=1).
 *  - MULTIPLE: minSelect <= maxSelect (when set); `required` implies min >= 1;
 *    maxSelect <= option count (checked by the use case once options are known).
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
      name: input.name,
      nameHy: input.nameHy ?? null,
      nameRu: input.nameRu ?? null,
      nameEn: input.nameEn ?? null,
      selectionType: input.selectionType,
      required: input.required ?? false,
      minSelect: normalized.minSelect,
      maxSelect: normalized.maxSelect,
      status: MenuStatus.ACTIVE,
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
    let min = minSelect ?? (required ? 1 : 0);
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
    // `required` implies at least one selection (coerced, not rejected).
    if (required && min < 1) {
      min = 1;
    }
    return { minSelect: min, maxSelect: max };
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get name(): string {
    return this.props.name;
  }
  /** LOCALE-2A: hy/ru/en translations of the name (nulls where untranslated). */
  get nameI18n(): I18nText {
    return { hy: this.props.nameHy, ru: this.props.nameRu, en: this.props.nameEn };
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
  get status(): MenuStatus {
    return this.props.status;
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
    nameHy?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
    selectionType?: ModifierSelectionType;
    required?: boolean;
    minSelect?: number | null;
    maxSelect?: number | null;
    status?: MenuStatus;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.nameHy !== undefined) this.props.nameHy = input.nameHy;
    if (input.nameRu !== undefined) this.props.nameRu = input.nameRu;
    if (input.nameEn !== undefined) this.props.nameEn = input.nameEn;
    if (input.selectionType !== undefined) this.props.selectionType = input.selectionType;
    if (input.required !== undefined) this.props.required = input.required;
    if (input.status !== undefined) this.props.status = input.status;

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

  setStatus(status: MenuStatus): void {
    this.props.status = status;
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
