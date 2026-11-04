import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { I18nText } from '../../../../shared/i18n/i18n-text';
import { MenuStatus } from '../enums';
import { CategoryHasItemsError } from '../menu.errors';

/** LOCALE-2A: the settable hy/ru/en translations (present ⇒ set/clear, absent ⇒ unchanged). */
export interface MenuI18nInput {
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  descriptionHy?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
}

export interface MenuCategoryProps {
  restaurantId: string;
  branchId: string;
  code: string;
  name: string;
  description: string | null;
  /** LOCALE-2A: nullable hy/ru/en translations of the primary name/description. */
  nameHy: string | null;
  nameRu: string | null;
  nameEn: string | null;
  descriptionHy: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  displayOrder: number;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateMenuCategoryInput {
  id: string;
  restaurantId: string;
  branchId: string;
  code: string;
  name: string;
  description?: string | null;
  nameHy?: string | null;
  nameRu?: string | null;
  nameEn?: string | null;
  descriptionHy?: string | null;
  descriptionRu?: string | null;
  descriptionEn?: string | null;
  displayOrder?: number;
}

/** MenuCategory aggregate (tenant-scoped by restaurantId). */
export class MenuCategory extends AggregateRoot<string> {
  private props: MenuCategoryProps;

  private constructor(id: string, props: MenuCategoryProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateMenuCategoryInput): MenuCategory {
    const now = new Date();
    return new MenuCategory(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      nameHy: input.nameHy ?? null,
      nameRu: input.nameRu ?? null,
      nameEn: input.nameEn ?? null,
      descriptionHy: input.descriptionHy ?? null,
      descriptionRu: input.descriptionRu ?? null,
      descriptionEn: input.descriptionEn ?? null,
      displayOrder: input.displayOrder ?? 0,
      status: MenuStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: MenuCategoryProps): MenuCategory {
    return new MenuCategory(id, props);
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

  rename(name: string, description?: string | null, i18n?: MenuI18nInput): void {
    this.props.name = name;
    if (description !== undefined) {
      this.props.description = description;
    }
    // LOCALE-2A: apply any provided translations (present ⇒ set/clear, absent ⇒ unchanged).
    if (i18n) {
      if (i18n.nameHy !== undefined) this.props.nameHy = i18n.nameHy;
      if (i18n.nameRu !== undefined) this.props.nameRu = i18n.nameRu;
      if (i18n.nameEn !== undefined) this.props.nameEn = i18n.nameEn;
      if (i18n.descriptionHy !== undefined) this.props.descriptionHy = i18n.descriptionHy;
      if (i18n.descriptionRu !== undefined) this.props.descriptionRu = i18n.descriptionRu;
      if (i18n.descriptionEn !== undefined) this.props.descriptionEn = i18n.descriptionEn;
    }
    this.touch();
  }

  reorder(displayOrder: number): void {
    this.props.displayOrder = displayOrder;
    this.touch();
  }

  activate(): void {
    this.props.status = MenuStatus.ACTIVE;
    this.touch();
  }

  deactivate(): void {
    this.props.status = MenuStatus.INACTIVE;
    this.touch();
  }

  /** Soft-delete; refuses if non-deleted items remain (invariant). */
  softDelete(activeItemCount: number): void {
    if (activeItemCount > 0) {
      throw new CategoryHasItemsError();
    }
    this.props.deletedAt = new Date();
    this.touch();
  }
}
