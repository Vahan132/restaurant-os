import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_ROLE_CODES,
  SYSTEM_ROLE_NAMES,
  SYSTEM_ROLE_PERMISSIONS,
  SystemRoleCode,
} from '../../domain/permissions.catalog';
import { ID_GENERATOR, IdGenerator } from '../ports/id-generator';

/** A ready-to-insert system-role record (Prisma-agnostic plain data). */
export interface SystemRoleSeed {
  id: string;
  organizationId: string;
  name: string;
  code: SystemRoleCode;
  permissions: string[];
  isSystem: true;
  createdAt: Date;
  updatedAt: Date;
}

/** The system role new users default to / organizations are owned by. */
export const OWNER_ROLE_CODE: SystemRoleCode = 'OWNER';

/**
 * Reusable system-role seeding logic (single source of truth = the catalog).
 * Produces the 6 system-role records for an organization; callers persist them
 * (the seed script, or platform provisioning inside a transaction). This is the
 * extraction of identity's role-seeding referenced by ProvisionOrganization.
 */
@Injectable()
export class SystemRoleSeeder {
  constructor(@Inject(ID_GENERATOR) private readonly ids: IdGenerator) {}

  build(organizationId: string): SystemRoleSeed[] {
    const now = new Date();
    return SYSTEM_ROLE_CODES.map((code) => ({
      id: this.ids.generate(),
      organizationId,
      name: SYSTEM_ROLE_NAMES[code],
      code,
      permissions: SYSTEM_ROLE_PERMISSIONS[code],
      isSystem: true as const,
      createdAt: now,
      updatedAt: now,
    }));
  }
}
