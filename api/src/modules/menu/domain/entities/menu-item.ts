import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { ItemAvailability, MenuStatus, PreparationStation } from '../enums';
import {
  MenuItemAvailabilityChangedEvent,
  MenuItemCreatedEvent,
  MenuItemDeletedEvent,
  MenuItemPriceChangedEvent,
} from '../events/menu-events';
import { NegativePriceError } from '../menu.errors';

export interface MenuItemProps {
  restaurantId: string;
  branchId: string;
  code: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceAmount: number;
  imageUrl: string | null;
  preparationStation: PreparationStation;
  prepTimeMinutes: number | null;
  status: MenuStatus;
  availability: ItemAvailability;
  /** CATALOG-3 §9: hides the customer ingredient list, not the allergen summary. */
  hideRecipe: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateMenuItemInput {
  id: string;
  restaurantId: string;
  branchId: string;
  code: string;
  categoryId: string;
  name: string;
  description?: string | null;
  priceAmount: number;
  imageUrl?: string | null;
  preparationStation?: PreparationStation;
  prepTimeMinutes?: number | null;
  actorUserId?: string | null;
}

/** MenuItem aggregate (parent-child by FK to category; tenant-scoped). */
export class MenuItem extends AggregateRoot<string> {
  private props: MenuItemProps;

  private constructor(id: string, props: MenuItemProps) {
    super(id);
    this.props = props;
  }

  private static assertPrice(amount: number): void {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new NegativePriceError('priceAmount');
    }
  }

  static create(input: CreateMenuItemInput): MenuItem {
    MenuItem.assertPrice(input.priceAmount);
    const now = new Date();
    const item = new MenuItem(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      code: input.code,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      priceAmount: input.priceAmount,
      imageUrl: input.imageUrl ?? null,
      preparationStation: input.preparationStation ?? PreparationStation.KITCHEN,
      prepTimeMinutes: input.prepTimeMinutes ?? null,
      status: MenuStatus.ACTIVE,
      availability: ItemAvailability.AVAILABLE,
      hideRecipe: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    item.addDomainEvent(
      new MenuItemCreatedEvent(
        input.id,
        input.restaurantId,
        input.categoryId,
        input.actorUserId ?? null,
      ),
    );
    return item;
  }

  static reconstitute(id: string, props: MenuItemProps): MenuItem {
    return new MenuItem(id, props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get code(): string {
    return this.props.code;
  }
  get categoryId(): string {
    return this.props.categoryId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get priceAmount(): number {
    return this.props.priceAmount;
  }
  get imageUrl(): string | null {
    return this.props.imageUrl;
  }
  get preparationStation(): PreparationStation {
    return this.props.preparationStation;
  }
  get prepTimeMinutes(): number | null {
    return this.props.prepTimeMinutes;
  }
  get status(): MenuStatus {
    return this.props.status;
  }
  get availability(): ItemAvailability {
    return this.props.availability;
  }
  get hideRecipe(): boolean {
    return this.props.hideRecipe;
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

  updateDetails(input: {
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
    preparationStation?: PreparationStation;
    prepTimeMinutes?: number | null;
    hideRecipe?: boolean;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.description !== undefined) this.props.description = input.description;
    if (input.imageUrl !== undefined) this.props.imageUrl = input.imageUrl;
    if (input.preparationStation !== undefined)
      this.props.preparationStation = input.preparationStation;
    if (input.prepTimeMinutes !== undefined) this.props.prepTimeMinutes = input.prepTimeMinutes;
    if (input.hideRecipe !== undefined) this.props.hideRecipe = input.hideRecipe;
    this.touch();
  }

  changePrice(newPriceAmount: number, actorUserId: string | null = null): void {
    MenuItem.assertPrice(newPriceAmount);
    const old = this.props.priceAmount;
    if (old !== newPriceAmount) {
      this.props.priceAmount = newPriceAmount;
      this.touch();
      this.addDomainEvent(
        new MenuItemPriceChangedEvent(
          this.id,
          this.props.restaurantId,
          old,
          newPriceAmount,
          actorUserId,
        ),
      );
    }
  }

  /** Reassign to another category (must belong to the same restaurant — checked by the use case). */
  assignToCategory(categoryId: string): void {
    this.props.categoryId = categoryId;
    this.touch();
  }

  setStatus(status: MenuStatus): void {
    this.props.status = status;
    this.touch();
  }

  setAvailability(availability: ItemAvailability): void {
    if (this.props.availability !== availability) {
      this.props.availability = availability;
      this.touch();
      this.addDomainEvent(
        new MenuItemAvailabilityChangedEvent(this.id, this.props.restaurantId, availability),
      );
    }
  }

  softDelete(actorUserId: string | null = null): void {
    this.props.deletedAt = new Date();
    this.touch();
    this.addDomainEvent(new MenuItemDeletedEvent(this.id, this.props.restaurantId, actorUserId));
  }
}
