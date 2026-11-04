import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// ── Requests ────────────────────────────────────────────────────────────────

export class ListExpensesQuery {
  @ApiProperty({ description: 'From date (YYYY-MM-DD, inclusive, restaurant tz).' })
  @Matches(DATE, { message: 'from must be YYYY-MM-DD' })
  from!: string;

  @ApiProperty({ description: 'To date (YYYY-MM-DD, inclusive, restaurant tz).' })
  @Matches(DATE, { message: 'to must be YYYY-MM-DD' })
  to!: string;

  @ApiPropertyOptional({ description: 'Only this category ("none" = uncategorised).' })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CreateExpenseDto {
  @ApiProperty({ description: 'What was bought / paid, e.g. "Chair", "Printer paper (monthly)".' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  description!: string;

  @ApiProperty({ description: 'Amount in integer MINOR units of the restaurant currency.' })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amount!: number;

  @ApiPropertyOptional({ description: 'When it was spent (ISO). Defaults to now.' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class ExpenseCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

// ── Responses ───────────────────────────────────────────────────────────────

export class ExpenseCategoryResponse {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() expenseCount!: number;
}

export class ExpenseResponse {
  @ApiProperty() id!: string;
  @ApiProperty() branchId!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ description: 'Integer minor units.' }) amount!: number;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ type: String, nullable: true }) categoryId!: string | null;
  @ApiProperty({ type: String, nullable: true }) categoryName!: string | null;
  @ApiProperty({ type: String, nullable: true }) note!: string | null;
  @ApiProperty() createdByUserId!: string;
  @ApiProperty({ type: String, nullable: true }) createdByName!: string | null;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
