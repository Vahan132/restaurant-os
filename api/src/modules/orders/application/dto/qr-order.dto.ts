import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** A single cart line. Server recomputes all pricing from this — no prices here. */
export class QrCartLineDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  menuItemId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ type: [String], description: 'Selected modifier option ids.' })
  @IsArray()
  @IsString({ each: true })
  modifierOptionIds!: string[];

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsString()
  note?: string | null;
}

/** Cart body — used for both cart validation and order creation. */
export class QrCartDto {
  @ApiProperty({ type: [QrCartLineDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QrCartLineDto)
  lines!: QrCartLineDto[];
}
