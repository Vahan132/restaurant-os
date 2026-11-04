import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { BranchMembership } from '../../domain/entities/branch-membership';
import { BranchMembershipView } from '../queries/list-branch-memberships.usecase';

/** Body for POST /users/:id/branch-memberships (upsert a user's role at a branch). */
export class UpsertBranchMembershipDto {
  @ApiProperty({ description: 'Branch the role applies at (must be in the restaurant).' })
  @IsString()
  @MinLength(1)
  branchId!: string;

  @ApiProperty({ description: 'Role id granted at this branch (same organization).' })
  @IsString()
  @MinLength(1)
  roleId!: string;
}

export class BranchMembershipResponse {
  @ApiProperty() branchId!: string;
  @ApiProperty({ nullable: true, type: String }) branchName!: string | null;
  @ApiProperty() userId!: string;
  @ApiProperty() roleId!: string;
  @ApiProperty({ nullable: true, type: String }) roleName!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(m: BranchMembership): BranchMembershipResponse {
    return {
      branchId: m.branchId,
      branchName: null,
      userId: m.userId,
      roleId: m.roleId,
      roleName: null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  static fromView(v: BranchMembershipView): BranchMembershipResponse {
    return {
      branchId: v.branchId,
      branchName: v.branchName,
      userId: v.userId,
      roleId: v.roleId,
      roleName: v.roleName,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    };
  }
}
