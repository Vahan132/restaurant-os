import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionStatus } from '../../domain/entities/subscription';

/** Change a subscription's plan and/or status. At least one should be provided. */
export class ChangeSubscriptionDto {
  @ApiPropertyOptional({ description: 'New plan id.' })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}
