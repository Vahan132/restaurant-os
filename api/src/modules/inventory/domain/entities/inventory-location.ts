import { Entity } from '../../../../shared/domain/entity';
import { InventoryLocationStatus, InventoryLocationType } from '../enums';

export interface InventoryLocationProps {
  restaurantId: string;
  branchId: string;
  name: string;
  systemType: InventoryLocationType;
  isDefault: boolean;
  status: InventoryLocationStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * InventoryLocation — a physical, branch-scoped shelf (6A). Three system
 * locations (MAIN_STORAGE / KITCHEN / BAR) are seeded per branch; managers add
 * CUSTOM ones. System locations cannot be deleted; CUSTOM ones only when empty
 * (the emptiness check lives in the use case, which reads on-hand). Exactly one
 * isDefault per branch = Main Storage.
 */
export class InventoryLocation extends Entity<string> {
  private props: InventoryLocationProps;

  private constructor(id: string, props: InventoryLocationProps) {
    super(id);
    this.props = props;
  }

  static create(input: {
    id: string;
    restaurantId: string;
    branchId: string;
    name: string;
    systemType?: InventoryLocationType;
    isDefault?: boolean;
  }): InventoryLocation {
    const now = new Date();
    return new InventoryLocation(input.id, {
      restaurantId: input.restaurantId,
      branchId: input.branchId,
      name: input.name,
      systemType: input.systemType ?? InventoryLocationType.CUSTOM,
      isDefault: input.isDefault ?? false,
      status: InventoryLocationStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  static reconstitute(id: string, props: InventoryLocationProps): InventoryLocation {
    return new InventoryLocation(id, props);
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
  get systemType(): InventoryLocationType {
    return this.props.systemType;
  }
  get isDefault(): boolean {
    return this.props.isDefault;
  }
  get status(): InventoryLocationStatus {
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

  /** System locations (Main Storage / Kitchen / Bar) are undeletable per §4. */
  get isSystem(): boolean {
    return this.props.systemType !== InventoryLocationType.CUSTOM;
  }

  rename(name: string): void {
    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.props.status = InventoryLocationStatus.ARCHIVED;
    this.props.updatedAt = new Date();
  }
}
