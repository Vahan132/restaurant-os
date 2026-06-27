import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsObject, IsString, ValidateNested } from 'class-validator';
import {
  OUTBOX_AGGREGATE_TYPES,
  OutboxAggregateType,
  OutboxOp,
} from '../../../../shared/edge/contracts/operational.contract';

/** One pushed outbox entry. `payload` is the aggregate's full JSON state. */
export class PushEntryDto {
  @ApiProperty({ description: 'The OutboxEntry id (echoed back in appliedIds).' })
  @IsString()
  id!: string;

  @ApiProperty({ description: 'Monotonic, gapless per-node sequence.' })
  @IsInt()
  edgeSeq!: number;

  @ApiProperty({ enum: OUTBOX_AGGREGATE_TYPES })
  @IsIn(OUTBOX_AGGREGATE_TYPES as unknown as string[])
  aggregateType!: OutboxAggregateType;

  @ApiProperty({ enum: ['CREATE', 'UPSERT'] })
  @IsIn(['CREATE', 'UPSERT'])
  op!: OutboxOp;

  @ApiProperty({ description: "The aggregate's full state (cloud-mirrored ids)." })
  @IsObject()
  payload!: Record<string, unknown>;
}

/** POST /edge-sync/push body. Entries are ordered by edgeSeq. */
export class PushRequestDto {
  @ApiProperty({ type: [PushEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PushEntryDto)
  entries!: PushEntryDto[];
}

export class PushResultDto {
  @ApiProperty({ type: [String] })
  appliedIds!: string[];

  @ApiProperty({ nullable: true, type: Number })
  lastAppliedSeq!: number | null;
}
