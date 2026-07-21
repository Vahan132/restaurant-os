import type {
  Branch,
  BranchInventoryPolicy,
  BranchMembership,
  Device,
  FiscalDepartment,
  Floor,
  InventoryCategory,
  InventoryItem,
  InventoryLocation,
  MenuCategory,
  MenuItem,
  ModifierConsumption,
  ModifierGroup,
  ModifierOption,
  Order,
  OrderCounter,
  OrderItem,
  OrderItemModifier,
  Organization,
  Payment,
  Process,
  ProcessInput,
  ProcessOutput,
  Recipe,
  RecipeLine,
  Reservation,
  Restaurant,
  RestaurantSettings,
  RestaurantTable,
  Role,
  StaffPin,
  StockLayer,
  StockOnHand,
  Supplier,
  User,
} from '@prisma/client';
import { FiscalConfigWire } from './fiscal-sync.mapper';

/**
 * Wire representation of a Prisma row: Dates become ISO strings and bigints
 * become decimal strings (JSON has neither). Everything else is preserved,
 * including ids — the edge MIRRORS cloud ids exactly (no remapping).
 */
export type Jsonify<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
      ? string | null
      : T[K] extends bigint
        ? string
        : T[K] extends bigint | null
          ? string | null
          : T[K];
};

/**
 * BranchSnapshot — a versioned, branch-scoped slice of cloud data for ONE edge
 * node's branch, with real cloud ids preserved throughout. Built by the cloud
 * EDGE_READ_MODEL and applied verbatim by the edge SnapshotApplier (OFF-2).
 *
 * Arrays are ordered in DEPENDENCY (foreign-key) order so the applier can upsert
 * top-to-bottom without violating constraints.
 */
export interface BranchSnapshot {
  meta: {
    /** Monotonic snapshot version (ms-epoch string at build time). */
    snapshotVersion: string;
    /** The cloud schema version the snapshot was built at. */
    schemaVersion: string;
    organization: Jsonify<Organization>;
    restaurant: Jsonify<Restaurant>;
    branch: Jsonify<Branch>;
    settings: Jsonify<RestaurantSettings> | null;
    timezone: string;
    currency: string;
  };

  /** Who can operate this branch + the credential material for offline login. */
  access: {
    roles: Jsonify<Role>[];
    users: Jsonify<User>[];
    branchMemberships: Jsonify<BranchMembership>[];
    /**
     * 3B: enrolled devices for this branch + staff PIN rows (HASHES ONLY — never
     * plaintext) so device-anchored PIN login works offline. Branch IP policy
     * rides the `branch` row and the admin toggle rides the `settings` row above.
     */
    devices: Jsonify<Device>[];
    staffPins: Jsonify<StaffPin>[];
  };

  /** Branch-owned catalog: menu + inventory + recipes + processes. */
  catalog: {
    menuCategories: Jsonify<MenuCategory>[];
    menuItems: Jsonify<MenuItem>[];
    modifierGroups: Jsonify<ModifierGroup>[];
    modifierOptions: Jsonify<ModifierOption>[];
    inventoryCategories: Jsonify<InventoryCategory>[];
    // 6C: locations + per-branch policy so the edge resolves consumption
    // locations + the negative-stock policy offline. Each item's
    // consumptionLocationId rides the inventoryItems rows.
    inventoryLocations: Jsonify<InventoryLocation>[];
    inventoryItems: Jsonify<InventoryItem>[];
    branchInventoryPolicies: Jsonify<BranchInventoryPolicy>[];
    suppliers: Jsonify<Supplier>[];
    recipes: Jsonify<Recipe>[];
    recipeLines: Jsonify<RecipeLine>[];
    modifierConsumptions: Jsonify<ModifierConsumption>[];
    processes: Jsonify<Process>[];
    processInputs: Jsonify<ProcessInput>[];
    processOutputs: Jsonify<ProcessOutput>[];
  };

  /**
   * Current OPEN FIFO stock layers (so FIFO works on the edge from day one) +
   * the per-(item, location) on-hand projection (6C) so the edge starts with the
   * correct location balances; the edge maintains both on local writes.
   */
  stock: {
    stockLayers: Jsonify<StockLayer>[];
    stockOnHand: Jsonify<StockOnHand>[];
  };

  /**
   * FISCAL-EDGE-1: cloud-authoritative fiscal + physical-device config so a
   * freshly-installed hub gets it at first boot (not only on the next incremental
   * config sync). Envelope-encrypted bytea rides base64 (FiscalConfigWire); the
   * cloud never decrypts. Empty arrays when the branch has no fiscal config yet.
   */
  fiscal: {
    fiscalConfigs: FiscalConfigWire[];
    fiscalDepartments: Jsonify<FiscalDepartment>[];
  };

  /** Operational starter set: tables + currently-open orders + upcoming bookings. */
  operational: {
    orderCounter: Jsonify<OrderCounter> | null;
    floors: Jsonify<Floor>[];
    tables: Jsonify<RestaurantTable>[];
    orders: Jsonify<Order>[];
    orderItems: Jsonify<OrderItem>[];
    orderItemModifiers: Jsonify<OrderItemModifier>[];
    payments: Jsonify<Payment>[];
    reservations: Jsonify<Reservation>[];
  };
}
