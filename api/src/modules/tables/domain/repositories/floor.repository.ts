import { Floor } from '../entities/floor';
import { ZoneStatus } from '../enums';

export const FLOOR_REPOSITORY = Symbol('FloorRepository');

export interface FloorListFilter {
  restaurantId: string;
  branchId: string;
  status?: ZoneStatus;
  includeInactive?: boolean;
}

/** Tenant-scoped by restaurantId + active branch. Excludes soft-deleted rows. */
export interface FloorRepository {
  list(filter: FloorListFilter): Promise<Floor[]>;
  findById(restaurantId: string, branchId: string, id: string): Promise<Floor | null>;
  /** Count non-deleted tables on a floor (for the delete invariant). */
  countActiveTables(restaurantId: string, branchId: string, floorId: string): Promise<number>;
  create(floor: Floor): Promise<void>;
  update(floor: Floor): Promise<void>;
}
