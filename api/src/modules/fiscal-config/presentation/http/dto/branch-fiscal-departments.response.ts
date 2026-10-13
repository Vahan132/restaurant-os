import { ApiProperty } from '@nestjs/swagger';
import { BranchFiscalDepartments } from '../../../application/ports/tenant-fiscal-department.reader';

/** A single non-secret fiscal department (menu-editor dropdown option). */
export class FiscalDepartmentItemResponse {
  @ApiProperty({ description: "SRC fiscal department code registered for this branch." })
  dep!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Human-friendly label for the department (optional).',
  })
  label!: string | null;
  @ApiProperty({ description: 'VAT tax regime associated with the department.' })
  taxRegime!: string;
}

/**
 * FISCAL-DEPT-3A: dedicated NON-SECRET response for the tenant fiscal-departments
 * read. Structurally has no cert/device/CRN field, so secrets cannot leak through
 * it. Do NOT extend the platform FiscalConfigStatusResponse here.
 */
export class BranchFiscalDepartmentsResponse {
  @ApiProperty({
    description: 'Whether fiscalization is active for this branch (false when unconfigured).',
  })
  fiscalActive!: boolean;
  @ApiProperty({
    type: [FiscalDepartmentItemResponse],
    description: 'Non-secret department list; empty when the branch has none registered.',
  })
  departments!: FiscalDepartmentItemResponse[];

  static from(v: BranchFiscalDepartments): BranchFiscalDepartmentsResponse {
    return {
      fiscalActive: v.fiscalActive,
      departments: v.departments.map((d) => ({
        dep: d.dep,
        label: d.label,
        taxRegime: d.taxRegime,
      })),
    };
  }
}
