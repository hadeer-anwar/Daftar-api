import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

import { TransactionType } from '../../transactions/schemas/transactions.schema';
import { RecurringFrequency } from '../enums/frequency.enum';

export class CreateRecurringTransactionDto {
  @ApiProperty({ example: 1500, description: 'Amount (must be positive)' })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.INCOME })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiPropertyOptional({
    example: '64abc123...',
    description: 'Required for expense recurring rules',
  })
  @ValidateIf((o) => o.type === TransactionType.EXPENSE)
  @IsNotEmpty({ message: 'categoryId is required for expense recurring rules' })
  @IsString()
  categoryId?: string;

  @ApiProperty({
    enum: RecurringFrequency,
    example: RecurringFrequency.MONTHLY,
  })
  @IsEnum(RecurringFrequency)
  frequency!: RecurringFrequency;

  @ApiProperty({
    example: '2026-06-01',
    description: 'When the recurring rule should start',
  })
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  startDate!: string;

  @ApiPropertyOptional({ example: 'Auto-pay rent', maxLength: 500 })
  @IsOptional()
  @IsString()
  notes?: string;
}
