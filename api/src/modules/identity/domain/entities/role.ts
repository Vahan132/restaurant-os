import { AggregateRoot } from '../../../../shared/domain/aggregate-root';
import { SystemRoleNotDeletableError, UnknownPermissionError } from '../identity.errors';
import { PermissionKey, unknownPermissionKeys } from '../permissions.catalog';

export interface RoleProps {
  organizationId: string;
  name: string;
  code: string;
  permissions: PermissionKey[];
  isSystem: boolean;
  /** ALL-BRANCH reach (FIX-E): true → the user sees/operates every branch. */
  allBranches: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRoleInput {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  permissions: string[];
  isSystem?: boolean;
  allBranches?: boolean;
}

/**
 * Role aggregate. Tenant-scoped (organizationId). Validates every permission
 * key against the catalog. System roles cannot be deleted.
 */
export class Role extends AggregateRoot<string> {
  private props: RoleProps;

  private constructor(id: string, props: RoleProps) {
    super(id);
    this.props = props;
  }

  static create(input: CreateRoleInput): Role {
    const permissions = Role.assertValidPermissions(input.permissions);
    const now = new Date();
    return new Role(input.id, {
      organizationId: input.organizationId,
      name: input.name,
      code: input.code,
      permissions,
      isSystem: input.isSystem ?? false,
      allBranches: input.allBranches ?? false,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: string, props: RoleProps): Role {
    return new Role(id, props);
  }

  private static assertValidPermissions(permissions: readonly string[]): PermissionKey[] {
    const unknown = unknownPermissionKeys(permissions);
    if (unknown.length > 0) {
      throw new UnknownPermissionError(unknown);
    }
    // De-duplicate while preserving order.
    return [...new Set(permissions)] as PermissionKey[];
  }

  // ── getters ────────────────────────────────────────────────────────────
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get code(): string {
    return this.props.code;
  }
  get permissions(): PermissionKey[] {
    return [...this.props.permissions];
  }
  get isSystem(): boolean {
    return this.props.isSystem;
  }
  /** ALL-BRANCH reach (FIX-E). */
  get allBranches(): boolean {
    return this.props.allBranches;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /** Replace the full permission set (validated against the catalog). */
  replacePermissions(permissions: string[]): void {
    this.props.permissions = Role.assertValidPermissions(permissions);
    this.touch();
  }

  rename(name: string): void {
    this.props.name = name;
    this.touch();
  }

  /** Guard invoked before deletion: system roles are protected. */
  ensureDeletable(): void {
    if (this.props.isSystem) {
      throw new SystemRoleNotDeletableError();
    }
  }

  hasPermission(key: string): boolean {
    return this.props.permissions.includes(key as PermissionKey);
  }
}
