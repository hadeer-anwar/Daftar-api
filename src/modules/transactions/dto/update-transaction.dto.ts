import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../schemas/transactions.schema';

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

  @ApiPropertyOptional({ enum: ['part-time', 'freelance', 'bonus', 'other'] })
  @IsOptional()
  @IsEnum(['part-time', 'freelance', 'bonus', 'other'])
  incomeType?: 'part-time' | 'freelance' | 'bonus' | 'other';

  @ApiPropertyOptional({ enum: ['monthly', 'one-time'] })
  @IsOptional()
  @IsEnum(['monthly', 'one-time'])
  repeat?: 'monthly' | 'one-time';
}
