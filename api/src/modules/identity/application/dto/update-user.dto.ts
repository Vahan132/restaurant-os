import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Partial update of a user's profile/role/scope. Status is changed via block/unblock. */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane A. Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Reassign to a role in the same organization.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  roleId?: string;

  @ApiPropertyOptional({ description: 'Change restaurant scope (must belong to the org).' })
  @IsOptional()
  @IsString()
  restaurantId?: string;

  @ApiPropertyOptional({ description: 'Change branch scope.' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
