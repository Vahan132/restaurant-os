import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { RecipeCreatedEvent } from '../events/inventory-events';

/** One ingredient line: an inventory item consumed per 1 unit of the dish. */
export interface RecipeLineProps {
  id: string;
  branchId: string;
  itemId: string;
  baseQty: number;
}

export class RecipeLine {
  constructor(private readonly props: RecipeLineProps) {}
  get id(): string {
    return this.props.id;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get baseQty(): number {
    return this.props.baseQty;
  }
}

/** Extra consumption triggered when a specific modifier option is selected. */
export interface ModifierConsumptionProps {
  id: string;
  restaurantId: string;
  branchId: string;
  modifierOptionId: string;
  itemId: string;
  baseQty: number;
}

export class ModifierConsumption {
  constructor(private readonly props: ModifierConsumptionProps) {}
  get id(): string {
    return this.props.id;
  }
  get restaurantId(): string {
    return this.props.restaurantId;
  }
  get branchId(): string {
    return this.props.branchId;
  }
  get modifierOptionId(): string {
    return this.props.modifierOptionId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get baseQty(): number {
    return this.props.baseQty;
  }
}

export interface RecipeProps {
  restaurantId: string;
  branchId: string;
  menuItemId: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  lines: RecipeLine[];
  modifierConsumptions: ModifierConsumption[];
}

/**
 * Recipe aggregate (BOM; catalog, soft-delete). One recipe per menu item
 * (uniqueness enforced by the use case + a DB unique index). menuItemId is a
 * cross-context reference into the menu module by id.
 */
export class Recipe extends AggregateRoot<string> {
  private props: RecipeProps;

  private constructor(id: string, props: RecipeProps) {
    super(id);
    this.props = props;
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    menuItemId: string;
    note?: string | null;
    lines: RecipeLine[];
    modifierConsumptions: ModifierConsumption[];
    actorUserId?: string | null;
  }): Recipe {
    const now = new Date();
    const recipe = new Recipe(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      menuItemId: input.menuItemId,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lines: input.lines,
      modifierConsumptions: input.modifierConsumptions,
    });
    recipe.addDomainEvent(
      new RecipeCreatedEvent(
        input.id,
        input.restaurantId,
        input.menuItemId,
        input.actorUserId ?? null,
      ),
    );
    return recipe;
  }

  static reconstitute(id: string, props: RecipeProps): Recipe {
    return new Recipe(id, props);
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
  get note(): string | null {
    return this.props.note;
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
  get lines(): RecipeLine[] {
    return this.props.lines;
  }
  get modifierConsumptions(): ModifierConsumption[] {
    return this.props.modifierConsumptions;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /** Full replacement of lines + modifier consumptions, plus note. */
  update(input: {
    note?: string | null;
    lines?: RecipeLine[];
    modifierConsumptions?: ModifierConsumption[];
  }): void {
    if (input.note !== undefined) this.props.note = input.note;
    if (input.lines !== undefined) this.props.lines = input.lines;
    if (input.modifierConsumptions !== undefined)
      this.props.modifierConsumptions = input.modifierConsumptions;
    this.touch();
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.touch();
  }
}
