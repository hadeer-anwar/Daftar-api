import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { BaseTransactionDto } from './base-transaction.dto';

export class CreateIncomeDto extends BaseTransactionDto {
  @IsEnum(['part-time', 'freelance', 'bonus', 'other'])
  incomeType!: 'part-time' | 'freelance' | 'bonus' | 'other';

  @IsString()
  @IsNotEmpty()
  payDate!: string;

  @IsString()
  repeat!: 'monthly' | 'one-time';
}
