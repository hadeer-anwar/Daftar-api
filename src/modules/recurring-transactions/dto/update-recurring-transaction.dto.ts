import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { IncomeType } from '../../transactions/schemas/transactions.schema';
import { RecurringFrequency } from '../enums/frequency.enum';
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
    description: 'Frequency of the recurring transaction',
    example: RecurringFrequency.MONTHLY,
  })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency;

  @ApiPropertyOptional({
    description: 'Indicates if the recurring transaction is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Type of the income',
    example: IncomeType.SALARY,
  })
  @IsOptional()
  @IsEnum(IncomeType)
  incomeType?: IncomeType;
}
