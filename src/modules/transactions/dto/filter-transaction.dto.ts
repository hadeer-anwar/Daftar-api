import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { TransactionType } from '../schemas/transactions.schema';

/**
 * Date range presets matching the UI filter sheet:
 * "This week" | "This Month" | "Last Month" | "This Year"
 */
export enum DateRangePreset {
  THIS_WEEK = 'this_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
}

export class FilterTransactionDto {
  @ApiPropertyOptional({
    enum: TransactionType,
    description: 'Filter by transaction type (expense or income)',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({
    enum: DateRangePreset,
    description: 'Quick date preset — overrides startDate/endDate if provided',
    example: DateRangePreset.THIS_MONTH,
  })
  @IsOptional()
  @IsEnum(DateRangePreset)
  preset?: DateRangePreset;

  @ApiPropertyOptional({
    example: '2026-05-01',
    description:
      'Custom range start date (ISO string). Ignored when preset is set.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be a valid ISO date string' })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-05-31',
    description:
      'Custom range end date (ISO string). Ignored when preset is set.',
  })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be a valid ISO date string' })
  endDate?: string;

  @ApiPropertyOptional({
    example: '64abc123...',
    description: 'Filter by category ID (expense transactions only)',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
