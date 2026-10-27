import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { IncomeType } from '../../transactions/schemas/transactions.schema';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRecurringTransactionDto {
  @ApiPropertyOptional({
    description: 'Amount of the transaction',
    example: 100.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Category ID of the transaction',
    example: 'category-id',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Notes for the transaction',
    example: 'Monthly subscription',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Name of the transaction',
    example: 'Monthly subscription',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Type of the income',
    example: IncomeType.SALARY,
  })
  @IsOptional()
  @IsEnum(IncomeType)
  incomeType?: IncomeType;

  @ApiPropertyOptional({
    example: 'Gift from family',
    description:
      'Required when incomeType is "other". Custom label for the income source.',
    maxLength: 100,
  })
  @ValidateIf((o) => o.incomeType === IncomeType.OTHER)
  @IsNotEmpty({
    message: 'customIncomeType is required when incomeType is other',
  })
  @IsString()
  @MaxLength(100)
  customIncomeType?: string;

  @ApiPropertyOptional({
    description:
      'Day of the month for the next (and future) runs. ' +
      'Only applies to monthly recurring rules',
    example: 15,
    minimum: 1,
    maximum: 28,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Total number of occurrences including the first. Omit for indefinite recurrence.',
    minimum: 1,
    maximum: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  repeatMonths?: number | null;
}
