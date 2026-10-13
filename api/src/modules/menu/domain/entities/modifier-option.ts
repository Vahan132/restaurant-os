import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { I18nText } from '../../../../shared/i18n/i18n-text';
import { MenuStatus } from '../enums';
import { InvalidPriceDeltaError } from '../menu.errors';

export interface ModifierOptionProps {
  restaurantId: string;
  branchId: string;
  modifierGroupId: string;
  name: string;
  /** LOCALE-2A: nullable hy/ru/en translations of the name. */
  nameHy: string | null;
  nameRu: string | null;
  nameEn: string | null;
  priceDeltaAmount: number;
  sortOrder: number;
  isDefault: boolean;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateModifierOptionInput {
  id: string;
  restaurantId: string;
  branchId: string;
  modifierGroupId: string;
  name: string;
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  priceDeltaAmount?: number;
  sortOrder?: number;
  isDefault?: boolean;
}

/** ModifierOption aggregate (child of a ModifierGroup; tenant-scoped). */
export class ModifierOption extends AggregateRoot<string> {
  private props: ModifierOptionProps;

  private constructor(id: string, props: ModifierOptionProps) {
    super(id);
    this.props = props;
  }

  // Prompt 1A: a price delta may be 0 or NEGATIVE (a discount). Only non-integers
  // are rejected — money is stored as integer minor units.
  private static assertDelta(amount: number): void {
    if (!Number.isInteger(amount)) {
      throw new InvalidPriceDeltaError('priceDeltaAmount');
    }
  }

  static create(input: CreateModifierOptionInput): ModifierOption {
    const delta = input.priceDeltaAmount ?? 0;
    ModifierOption.assertDelta(delta);
    const now = new Date();
    return new ModifierOption(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      modifierGroupId: input.modifierGroupId,
      name: input.name,
      nameHy: input.nameHy ?? null,
      nameRu: input.nameRu ?? null,
      nameEn: input.nameEn ?? null,
      priceDeltaAmount: delta,
      sortOrder: input.sortOrder ?? 0,
      isDefault: input.isDefault ?? false,
      status: MenuStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: ModifierOptionProps): ModifierOption {
    return new ModifierOption(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get modifierGroupId(): string {
    return this.props.modifierGroupId;
  }
  get name(): string {
    return this.props.name;
  }
  /** LOCALE-2A: hy/ru/en translations of the name (nulls where untranslated). */
  get nameI18n(): I18nText {
    return { hy: this.props.nameHy, ru: this.props.nameRu, en: this.props.nameEn };
  }
  get priceDeltaAmount(): number {
    return this.props.priceDeltaAmount;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
  }
  get isDefault(): boolean {
    return this.props.isDefault;
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
    priceDeltaAmount?: number;
    sortOrder?: number;
    isDefault?: boolean;
    status?: MenuStatus;
  }): void {
    if (input.priceDeltaAmount !== undefined) {
      ModifierOption.assertDelta(input.priceDeltaAmount);
      this.props.priceDeltaAmount = input.priceDeltaAmount;
    }
    if (input.name !== undefined) this.props.name = input.name;
    if (input.nameHy !== undefined) this.props.nameHy = input.nameHy;
    if (input.nameRu !== undefined) this.props.nameRu = input.nameRu;
    if (input.nameEn !== undefined) this.props.nameEn = input.nameEn;
    if (input.sortOrder !== undefined) this.props.sortOrder = input.sortOrder;
    if (input.isDefault !== undefined) this.props.isDefault = input.isDefault;
    if (input.status !== undefined) this.props.status = input.status;
    this.touch();
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.touch();
  }
}
