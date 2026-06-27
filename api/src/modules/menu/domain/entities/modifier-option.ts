import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { MenuStatus } from '../enums';
import { NegativePriceError } from '../menu.errors';

export interface ModifierOptionProps {
  restaurantId: string;
  branchId: string;
  modifierGroupId: string;
  name: string;
  priceDeltaAmount: number;
  displayOrder: number;
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
  priceDeltaAmount?: number;
  displayOrder?: number;
}

/** ModifierOption aggregate (child of a ModifierGroup; tenant-scoped). */
export class ModifierOption extends AggregateRoot<string> {
  private props: ModifierOptionProps;

  private constructor(id: string, props: ModifierOptionProps) {
    super(id);
    this.props = props;
  }

  private static assertDelta(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new NegativePriceError('priceDeltaAmount');
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
      priceDeltaAmount: delta,
      displayOrder: input.displayOrder ?? 0,
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
  get priceDeltaAmount(): number {
    return this.props.priceDeltaAmount;
  }
  get displayOrder(): number {
    return this.props.displayOrder;
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
    priceDeltaAmount?: number;
    displayOrder?: number;
    status?: MenuStatus;
  }): void {
    if (input.priceDeltaAmount !== undefined) {
      ModifierOption.assertDelta(input.priceDeltaAmount);
      this.props.priceDeltaAmount = input.priceDeltaAmount;
    }
    if (input.name !== undefined) this.props.name = input.name;
    if (input.displayOrder !== undefined) this.props.displayOrder = input.displayOrder;
    if (input.status !== undefined) this.props.status = input.status;
    this.touch();
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.touch();
  }
}
