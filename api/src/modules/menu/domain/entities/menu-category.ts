import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { MenuStatus } from '../enums';
import { CategoryHasItemsError } from '../menu.errors';

export interface MenuCategoryProps {
  restaurantId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  status: MenuStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateMenuCategoryInput {
  id: string;
  restaurantId: string;
  name: string;
  description?: string | null;
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
      name: input.name,
      description: input.description ?? null,
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
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
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

  rename(name: string, description?: string | null): void {
    this.props.name = name;
    if (description !== undefined) {
      this.props.description = description;
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
