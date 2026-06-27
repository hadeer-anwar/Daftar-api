import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
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
    description: 'Type of the income',
    example: IncomeType.SALARY,
  })
  @IsOptional()
  @IsEnum(IncomeType)
  incomeType?: IncomeType;

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
}
