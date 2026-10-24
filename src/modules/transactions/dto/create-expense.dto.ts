import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseTransactionDto } from './base-transaction.dto';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { TransactionType } from '../schemas/transactions.schema';
export class CreateExpenseTransactionDto extends BaseTransactionDto {
  @ApiProperty({
    enum: [TransactionType.EXPENSE],
    example: TransactionType.EXPENSE,
  })
  @IsEnum(TransactionType)
  transactionType!: TransactionType.EXPENSE;

  @ApiProperty()
  @IsString()
  categoryId!: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty({
    enum: ['monthly', 'one-time'],
  })
  @IsEnum(['monthly', 'one-time'])
  repeat!: 'monthly' | 'one-time';

  @ApiPropertyOptional({
    example: 3,
    description: 'Total number of monthly occurrences, including the first.',
    minimum: 1,
    maximum: 120,
  })
  @ValidateIf((o: CreateExpenseTransactionDto) => o.repeat === 'monthly')
  @IsInt()
  @Min(1)
  @Max(120)
  repeatMonths?: number;
}
