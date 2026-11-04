import { AggregateRoot } from '../../../../shared/domain/aggregate-root';

export enum CatalogItemStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

/**
 * CATALOG-UNIT-1: measurement unit of a catalog item (mirrors the inventory base
 * units: weight in grams, volume in millilitres, or counted pieces).
 */
export enum CatalogUnit {
  GRAM = 'GRAM',
  MILLILITER = 'MILLILITER',
  PIECE = 'PIECE',
}

export interface CatalogItemProps {
  slug: string;
  nameHy: string;
  nameRu: string;
  nameEn: string;
  categoryId: string | null;
  baseUnit: CatalogUnit;
  status: CatalogItemStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateCatalogItemProps {
  id: string;
  slug: string;
  nameHy: string;
  nameRu: string;
  nameEn: string;
  categoryId: string | null;
  /** Defaults to GRAM. */
  baseUnit?: CatalogUnit;
}

/**
 * CatalogItem aggregate — a PLATFORM-owned curated stock-item template (ADR §2).
 * Not tenant-scoped. Deletion is ARCHIVE, not hard-delete, so a tenant's
 * catalogItemId reference is never orphaned (CATALOG-2 / ADR §4).
 */
export class CatalogItem extends AggregateRoot<string> {
  private props: CatalogItemProps;

  private constructor(id: string, props: CatalogItemProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateCatalogItemProps): CatalogItem {
    const now = new Date();
    return new CatalogItem(input.id, {
      slug: input.slug,
      nameHy: input.nameHy,
      nameRu: input.nameRu,
      nameEn: input.nameEn,
      categoryId: input.categoryId,
      baseUnit: input.baseUnit ?? CatalogUnit.GRAM,
      status: CatalogItemStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: CatalogItemProps): CatalogItem {
    return new CatalogItem(id, props);
  }

  get slug(): string {
    return this.props.slug;
  }
  get nameHy(): string {
    return this.props.nameHy;
  }
  get nameRu(): string {
    return this.props.nameRu;
  }
  get nameEn(): string {
    return this.props.nameEn;
  }
  get categoryId(): string | null {
    return this.props.categoryId;
  }
  get baseUnit(): CatalogUnit {
    return this.props.baseUnit;
  }
  get status(): CatalogItemStatus {
    return this.props.status;
  }
  get isArchived(): boolean {
    return this.props.status === CatalogItemStatus.ARCHIVED;
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

  /**
   * Patch mutable fields. `undefined` = leave unchanged; `null` on categoryId
   * clears it.
   */
  update(input: {
    nameHy?: string;
    nameRu?: string;
    nameEn?: string;
    categoryId?: string | null;
    baseUnit?: CatalogUnit;
  }): void {
    if (input.nameHy !== undefined) this.props.nameHy = input.nameHy;
    if (input.nameRu !== undefined) this.props.nameRu = input.nameRu;
    if (input.nameEn !== undefined) this.props.nameEn = input.nameEn;
    if (input.categoryId !== undefined) this.props.categoryId = input.categoryId;
    if (input.baseUnit !== undefined) this.props.baseUnit = input.baseUnit;
    this.touch();
  }

  /** Archive (soft-delete). Idempotent. Existing tenant references still resolve. */
  archive(): void {
    if (this.props.status === CatalogItemStatus.ARCHIVED) {
      return;
    }
    this.props.status = CatalogItemStatus.ARCHIVED;
    this.props.deletedAt = new Date();
    this.touch();
  }
}
