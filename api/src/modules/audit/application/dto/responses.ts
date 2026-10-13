import { ApiProperty } from '@nestjs/swagger';
import { AuditLog } from '../../domain/entities/audit-log';

export class AuditLogResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) organizationId!: string | null;
  @ApiProperty({ nullable: true, type: String }) restaurantId!: string | null;
  @ApiProperty({ nullable: true, type: String }) branchId!: string | null;
  @ApiProperty({ enum: ['USER', 'PLATFORM_USER', 'SYSTEM'] }) actorType!: string;
  @ApiProperty({ nullable: true, type: String }) actorId!: string | null;
  @ApiProperty({ nullable: true, type: String }) actorName!: string | null;
  @ApiProperty({ nullable: true, type: String }) actorRoleCode!: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() entityType!: string;
  @ApiProperty() entityId!: string;
  @ApiProperty({ nullable: true, type: Object }) oldValue!: unknown | null;
  @ApiProperty({ nullable: true, type: Object }) newValue!: unknown | null;
  @ApiProperty({ nullable: true, type: String }) ip!: string | null;
  @ApiProperty({ nullable: true, type: String }) userAgent!: string | null;
  @ApiProperty() createdAt!: string;

  static from(l: AuditLog): AuditLogResponse {
    return {
      id: l.id,
      organizationId: l.organizationId,
      restaurantId: l.restaurantId,
      branchId: l.branchId,
      actorType: l.actorType,
      actorId: l.actorId,
      actorName: l.actorName,
      actorRoleCode: l.actorRoleCode,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      oldValue: l.oldValue,
      newValue: l.newValue,
      ip: l.ip,
      userAgent: l.userAgent,
      createdAt: l.createdAt.toISOString(),
    };
  }
}
