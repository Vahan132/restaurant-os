import type {
  Branch,
  BranchMembership,
  Device,
  FiscalDepartment,
  InventoryCategory,
  InventoryItem,
  MenuCategory,
  MenuItem,
  ModifierConsumption,
  ModifierGroup,
  ModifierOption,
  Organization,
  Process,
  ProcessInput,
  ProcessOutput,
  Recipe,
  RecipeLine,
  Restaurant,
  RestaurantSettings,
  Role,
  StaffPin,
  Supplier,
  User,
} from '@prisma/client';
import { Jsonify } from './snapshot.contract';
import { FiscalConfigWire } from './fiscal-sync.mapper';

/**
 * ConfigChanges (OFF-3) — an INCREMENTAL, branch-scoped slice of CLOUD-AUTHORITATIVE
 * config changed since a cursor. Config only: catalog, users/roles/memberships,
 * settings/meta. NO stock or operational data (those sync UP in OFF-4).
 *
 * Cursor semantics: `cursor` is an ISO-8601 timestamp. The cloud returns rows
 * whose `updatedAt >= since` (INCLUDING soft-deleted, carrying `deletedAt`, so
 * the edge can mirror deletions), and a NEW cursor pulled back by a small overlap
 * so no change can be skipped across windows. Re-applying a window is idempotent.
 *
 * Children without their own `updatedAt` (recipe lines / modifier consumptions /
 * process inputs+outputs) are sent as the FULL current children of each CHANGED
 * recipe/process; the edge reconciles them (replace-by-parent). Branch
 * memberships are sent as the FULL current set for the branch (cloud hard-deletes
 * them) so the edge can reconcile removals.
 */
export interface ConfigChanges {
  /** New cursor to send as `since` next time (ISO-8601, overlap-adjusted). */
  cursor: string;
  changes: {
    // meta (sent only when changed)
    organization: Jsonify<Organization> | null;
    restaurant: Jsonify<Restaurant> | null;
    branch: Jsonify<Branch> | null;
    settings: Jsonify<RestaurantSettings> | null;

    // access
    roles: Jsonify<Role>[];
    users: Jsonify<User>[];
    /** FULL current membership set for the branch — the edge reconciles removals. */
    branchMemberships: Jsonify<BranchMembership>[];

    // 3B: device-anchored auth material (changed-since). Devices + StaffPin rows
    // (HASHES ONLY). Revocations ride as status changes (updatedAt bumps). The
    // edge PRESERVES its local PIN lockout counters when applying these.
    devices: Jsonify<Device>[];
    staffPins: Jsonify<StaffPin>[];

    // catalog: menu + inventory (each row carries its own updatedAt + deletedAt)
    menuCategories: Jsonify<MenuCategory>[];
    menuItems: Jsonify<MenuItem>[];
    modifierGroups: Jsonify<ModifierGroup>[];
    modifierOptions: Jsonify<ModifierOption>[];
    inventoryCategories: Jsonify<InventoryCategory>[];
    inventoryItems: Jsonify<InventoryItem>[];
    suppliers: Jsonify<Supplier>[];

    // recipes + processes: parents carry updatedAt; children are FULL per changed parent
    recipes: Jsonify<Recipe>[];
    recipeLines: Jsonify<RecipeLine>[];
    modifierConsumptions: Jsonify<ModifierConsumption>[];
    processes: Jsonify<Process>[];
    processInputs: Jsonify<ProcessInput>[];
    processOutputs: Jsonify<ProcessOutput>[];

    // FISCAL-EDGE-1: cloud-authoritative fiscal + physical-device config, carried
    // read-only to the hub. FiscalConfig has its own updatedAt (changed-since);
    // its ENVELOPE-ENCRYPTED bytea columns ride base64 (FiscalConfigWire) and the
    // cloud never decrypts them. FiscalDepartment has NO updatedAt — it ships as
    // the FULL current children of each CHANGED config (reconcile replace-by-parent,
    // like recipe lines). Empty when nothing fiscal changed since the cursor.
    fiscalConfigs: FiscalConfigWire[];
    fiscalDepartments: Jsonify<FiscalDepartment>[];
  };
}
