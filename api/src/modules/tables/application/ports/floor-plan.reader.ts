export const FLOOR_PLAN_READER = Symbol('FloorPlanReader');

export interface FloorPlanTable {
  id: string;
  name: string;
  seatCapacity: number;
  status: string;
  qrIdentifier: string | null;
}

export interface FloorPlanFloor {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  tables: FloorPlanTable[];
}

/**
 * Read model for POS/admin floor view: ACTIVE floors (ordered) -> their tables
 * with current status. INACTIVE floors + soft-deleted rows are excluded.
 */
export interface FloorPlanReader {
  getFloorPlan(restaurantId: string): Promise<FloorPlanFloor[]>;
}
