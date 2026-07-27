import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  MaxLength,
  Min,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IncomeType, TransactionType } from '../schemas/transactions.schema';

export class UpdateTransactionDto {
  @ApiPropertyOptional({ example: 750 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({ example: '2026-05-09' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  payDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '64abc123...' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    enum: IncomeType,
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

  @ApiPropertyOptional({ enum: ['monthly', 'one-time'] })
  @IsOptional()
  @IsEnum(['monthly', 'one-time'])
  repeat?: 'monthly' | 'one-time';
}
