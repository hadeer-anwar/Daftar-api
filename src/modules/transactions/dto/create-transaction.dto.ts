import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsNotEmpty,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../schemas/transactions.schema';

export class CreateTransactionDto {
  @ApiProperty({
    example: 500,
    description: 'Transaction amount (must be positive)',
  })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be greater than 0' })
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  transactionType!: TransactionType;

  // ─── Expense-only fields ────────────────────────────────────────────────────

  @ApiProperty({
    example: '64abc123...',
    description: 'Required for expense transactions',
  })
  @ValidateIf((o) => o.transactionType === TransactionType.EXPENSE)
  @IsNotEmpty({ message: 'categoryId is required for expense transactions' })
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: '2026-05-09',
    description: 'Expense date (ISO string). Defaults to now if omitted.',
  })
  @ValidateIf((o) => o.transactionType === TransactionType.EXPENSE)
  @IsOptional()
  @IsDateString({}, { message: 'date must be a valid ISO date string' })
  date?: string;

  @ApiPropertyOptional({
    example: 'Pizza dinner',
    description: 'Optional notes for any transaction',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  // ─── Income-only fields ─────────────────────────────────────────────────────

  @ApiProperty({
    enum: ['salary', 'part-time', 'freelance', 'bonus', 'other'],
    example: 'freelance',
    description: 'Required for income transactions',
  })
  @ValidateIf((o) => o.transactionType === TransactionType.INCOME)
  @IsNotEmpty({ message: 'incomeType is required for income transactions' })
  @IsEnum(['salary', 'part-time', 'freelance', 'bonus', 'other'], {
    message:
      'incomeType must be one of: salary, part-time, freelance, bonus, other',
  })
  incomeType?: 'salary' | 'part-time' | 'freelance' | 'bonus' | 'other';

  @ApiProperty({
    example: '2026-06-01',
    description: 'Pay date (ISO string). Required for income transactions.',
  })
  @ValidateIf((o) => o.transactionType === TransactionType.INCOME)
  @IsNotEmpty({ message: 'payDate is required for income transactions' })
  @IsDateString({}, { message: 'payDate must be a valid ISO date string' })
  payDate?: string;

  @ApiProperty({
    enum: ['monthly', 'one-time'],
    example: 'monthly',
    description: 'Required for income transactions',
  })
  @ValidateIf((o) => o.transactionType === TransactionType.INCOME)
  @IsNotEmpty({ message: 'repeat is required for income transactions' })
  @IsEnum(['monthly', 'one-time'], {
    message: 'repeat must be either monthly or one-time',
  })
  repeat?: 'monthly' | 'one-time';
}
