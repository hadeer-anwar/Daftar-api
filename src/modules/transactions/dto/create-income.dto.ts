import { ApiProperty } from '@nestjs/swagger';
import { BaseTransactionDto } from './base-transaction.dto';
import { IsDateString, IsEnum } from 'class-validator';
import { TransactionType } from '../schemas/transactions.schema';

export class CreateIncomeTransactionDto extends BaseTransactionDto {
  @ApiProperty({
    enum: [TransactionType.INCOME],
    example: TransactionType.INCOME,
  })
  @IsEnum(TransactionType)
  transactionType!: TransactionType.INCOME;

  @ApiProperty({
    enum: ['salary', 'part-time', 'freelance', 'bonus', 'other'],
  })
  incomeType!: 'salary' | 'part-time' | 'freelance' | 'bonus' | 'other';

  @ApiProperty()
  @IsDateString()
  payDate!: string;

  @ApiProperty({
    enum: ['monthly', 'one-time'],
  })
  repeat!: 'monthly' | 'one-time';
}
