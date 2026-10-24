import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseTransactionDto } from './base-transaction.dto';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
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

  @ApiPropertyOptional({
    example: 3,
    description: 'Total number of monthly occurrences, including the first.',
    minimum: 1,
    maximum: 120,
  })
  @ValidateIf((o: CreateIncomeTransactionDto) => o.repeat === 'monthly')
  @IsInt()
  @Min(1)
  @Max(120)
  repeatMonths?: number;
}
