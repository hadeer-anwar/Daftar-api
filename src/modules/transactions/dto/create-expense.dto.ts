import { ApiProperty } from '@nestjs/swagger';
import { BaseTransactionDto } from './base-transaction.dto';
import { IsDateString, IsEnum, IsString } from 'class-validator';
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
}
