import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../../../../shared/application/pagination';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({ default: DEFAULT_LIMIT, minimum: 1, maximum: MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}

export class PlatformUsersQuery extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional({ description: 'Match email or name.' })
  @IsOptional()
  @IsString()
  search?: string;
  @ApiPropertyOptional({ description: 'Role code (e.g. OWNER, WAITER).' })
  @IsOptional()
  @IsString()
  role?: string;
  @ApiPropertyOptional({ enum: ['ACTIVE', 'BLOCKED'] }) @IsOptional() @IsString() status?: string;
}

class HallResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() tableCount!: number;
}
export class RestaurantWithHallsResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() status!: string;
  @ApiProperty() currency!: string;
  @ApiProperty() totalTables!: number;
  @ApiProperty({ type: [HallResponse] }) halls!: HallResponse[];
}
export class SubscriptionHistoryAdminResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ nullable: true, type: String }) fromStatus!: string | null;
  @ApiProperty({ nullable: true, type: String }) toStatus!: string | null;
  @ApiProperty({ nullable: true, type: String }) fromPlanId!: string | null;
  @ApiProperty({ nullable: true, type: String }) fromPlanName!: string | null;
  @ApiProperty({ nullable: true, type: String }) toPlanId!: string | null;
  @ApiProperty({ nullable: true, type: String }) toPlanName!: string | null;
  @ApiProperty() changedByType!: string;
  @ApiProperty({ nullable: true, type: String }) changedByUserId!: string | null;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty() createdAt!: string;
}
class UserOrgRef {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}
export class PlatformUserRowResponse {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ nullable: true, type: String }) roleName!: string | null;
  @ApiProperty({ type: UserOrgRef }) organization!: UserOrgRef;
  @ApiProperty({ type: UserOrgRef, nullable: true }) restaurant!: UserOrgRef | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ nullable: true, type: String }) lastLoginAt!: string | null;
}
class NewSignupsResponse {
  @ApiProperty() last7Days!: number;
  @ApiProperty() last30Days!: number;
}
export class PlatformDashboardResponse {
  @ApiProperty() totalOrganizations!: number;
  @ApiProperty({ type: Object }) organizationsByStatus!: Record<string, number>;
  @ApiProperty({ type: Object }) subscriptionsByStatus!: Record<string, number>;
  @ApiProperty() totalRestaurants!: number;
  @ApiProperty() totalTables!: number;
  @ApiProperty() totalUsers!: number;
  @ApiProperty({ type: NewSignupsResponse }) newSignups!: NewSignupsResponse;
}
