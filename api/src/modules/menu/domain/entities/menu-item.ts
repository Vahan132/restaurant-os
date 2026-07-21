import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { I18nText } from '../../../../shared/i18n/i18n-text';
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
  /** LOCALE-2A: nullable hy/ru/en translations of the primary name/description. */
  nameHy: string | null;
  nameRu: string | null;
  nameEn: string | null;
  descriptionHy: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  priceAmount: number;
  imageUrl: string | null;
  /** MEDIA-1: object-storage key when the image was uploaded (null for URL-paste). */
  imageKey: string | null;
  preparationStation: PreparationStation;
  prepTimeMinutes: number | null;
  status: MenuStatus;
  availability: ItemAvailability;
  /** CATALOG-3 §9: hides the customer ingredient list, not the allergen summary. */
  hideRecipe: boolean;
  /**
   * FISCAL-0/ADGCODE-UI: the dish-level SRC ATG classifier code for fiscalization.
   * null = not yet classified (fiscal print fail-closes on a null line, error 192).
   */
  adgCode: string | null;
  /**
   * FISCAL-DEPT-1: the branch's SRC fiscal department code this dish sells under
   * (matches a FiscalDepartment.dep in this branch). Validated on assignment;
   * snapshotted onto OrderItem.dep at order-build. null = unassigned (fiscal print
   * fail-closes on a null line for fiscal-active branches, DEP_REQUIRED).
   */
  dep: string | null;
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
  /** LOCALE-2A: optional hy/ru/en translations (absent → null). */
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  descriptionHy?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  priceAmount: number;
  imageUrl?: string | null;
  imageKey?: string | null;
  preparationStation?: PreparationStation;
  prepTimeMinutes?: number | null;
  adgCode?: string | null;
  /** FISCAL-DEPT-1: branch fiscal department code (absent → null). */
  dep?: string | null;
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
      nameHy: input.nameHy ?? null,
      nameRu: input.nameRu ?? null,
      nameEn: input.nameEn ?? null,
      descriptionHy: input.descriptionHy ?? null,
      descriptionRu: input.descriptionRu ?? null,
      descriptionEn: input.descriptionEn ?? null,
      priceAmount: input.priceAmount,
      imageUrl: input.imageUrl ?? null,
      imageKey: input.imageKey ?? null,
      preparationStation: input.preparationStation ?? PreparationStation.KITCHEN,
      prepTimeMinutes: input.prepTimeMinutes ?? null,
      status: MenuStatus.ACTIVE,
      availability: ItemAvailability.AVAILABLE,
      hideRecipe: false,
      adgCode: input.adgCode ?? null,
      dep: input.dep ?? null,
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
  /** LOCALE-2A: hy/ru/en translations of the name (nulls where untranslated). */
  get nameI18n(): I18nText {
    return { hy: this.props.nameHy, ru: this.props.nameRu, en: this.props.nameEn };
  }
  /** LOCALE-2A: hy/ru/en translations of the description. */
  get descriptionI18n(): I18nText {
    return {
      hy: this.props.descriptionHy,
      ru: this.props.descriptionRu,
      en: this.props.descriptionEn,
    };
  }
  get priceAmount(): number {
    return this.props.priceAmount;
  }
  get imageUrl(): string | null {
    return this.props.imageUrl;
  }
  get imageKey(): string | null {
    return this.props.imageKey;
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
  get adgCode(): string | null {
    return this.props.adgCode;
  }
  get dep(): string | null {
    return this.props.dep;
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
    // LOCALE-2A: translations — present (incl. explicit null) sets/clears; absent leaves unchanged.
    nameHy?: string | null;
    nameRu?: string | null;
    nameEn?: string | null;
    descriptionHy?: string | null;
    descriptionRu?: string | null;
    descriptionEn?: string | null;
    imageUrl?: string | null;
    imageKey?: string | null;
    preparationStation?: PreparationStation;
    prepTimeMinutes?: number | null;
    hideRecipe?: boolean;
    adgCode?: string | null;
    dep?: string | null;
  }): void {
    if (input.name !== undefined) this.props.name = input.name;
    if (input.description !== undefined) this.props.description = input.description;
    if (input.nameHy !== undefined) this.props.nameHy = input.nameHy;
    if (input.nameRu !== undefined) this.props.nameRu = input.nameRu;
    if (input.nameEn !== undefined) this.props.nameEn = input.nameEn;
    if (input.descriptionHy !== undefined) this.props.descriptionHy = input.descriptionHy;
    if (input.descriptionRu !== undefined) this.props.descriptionRu = input.descriptionRu;
    if (input.descriptionEn !== undefined) this.props.descriptionEn = input.descriptionEn;
    if (input.imageUrl !== undefined) this.props.imageUrl = input.imageUrl;
    if (input.imageKey !== undefined) this.props.imageKey = input.imageKey;
    if (input.preparationStation !== undefined)
      this.props.preparationStation = input.preparationStation;
    if (input.prepTimeMinutes !== undefined) this.props.prepTimeMinutes = input.prepTimeMinutes;
    if (input.hideRecipe !== undefined) this.props.hideRecipe = input.hideRecipe;
    // Partial-update: omitted (undefined) leaves the code untouched; null clears it.
    if (input.adgCode !== undefined) this.props.adgCode = input.adgCode;
    // FISCAL-DEPT-1: same partial-update semantics; validation happens in the use case.
    if (input.dep !== undefined) this.props.dep = input.dep;
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
