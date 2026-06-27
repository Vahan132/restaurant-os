import type {
  Branch,
  BranchMembership,
  Floor,
  InventoryCategory,
  InventoryItem,
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
  StockLayer,
  Supplier,
  User,
} from '@prisma/client';

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
  };

  /** Branch-owned catalog: menu + inventory + recipes + processes. */
  catalog: {
    menuCategories: Jsonify<MenuCategory>[];
    menuItems: Jsonify<MenuItem>[];
    modifierGroups: Jsonify<ModifierGroup>[];
    modifierOptions: Jsonify<ModifierOption>[];
    inventoryCategories: Jsonify<InventoryCategory>[];
    inventoryItems: Jsonify<InventoryItem>[];
    suppliers: Jsonify<Supplier>[];
    recipes: Jsonify<Recipe>[];
    recipeLines: Jsonify<RecipeLine>[];
    modifierConsumptions: Jsonify<ModifierConsumption>[];
    processes: Jsonify<Process>[];
    processInputs: Jsonify<ProcessInput>[];
    processOutputs: Jsonify<ProcessOutput>[];
  };

  /** Current OPEN FIFO stock layers (so FIFO works on the edge from day one). */
  stock: {
    stockLayers: Jsonify<StockLayer>[];
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
