import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseTransactionDto } from './base-transaction.dto';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IncomeType, TransactionType } from '../schemas/transactions.schema';

export class CreateIncomeTransactionDto extends BaseTransactionDto {
  @ApiProperty({
    enum: [TransactionType.INCOME],
    example: TransactionType.INCOME,
  })
  @IsEnum(TransactionType)
  transactionType!: TransactionType.INCOME;

  @ApiProperty({
    enum: IncomeType,
    example: IncomeType.SALARY,
  })
  @IsEnum(IncomeType)
  incomeType!: IncomeType;

  @ApiPropertyOptional({
    example: 'Gift from family',
    description:
      'Required when incomeType is "other". Custom label for the income source.',
    maxLength: 100,
  })
  @ValidateIf(
    (o: CreateIncomeTransactionDto) => o.incomeType === IncomeType.OTHER,
  )
  @IsNotEmpty({
    message: 'customIncomeType is required when incomeType is other',
  })
  @IsString()
  @MaxLength(100)
  customIncomeType?: string;

  @ApiProperty()
  @IsDateString()
  payDate!: string;

  @ApiProperty({
    enum: ['monthly', 'one-time'],
  })
  @IsEnum(['monthly', 'one-time'])
  repeat!: 'monthly' | 'one-time';
}
