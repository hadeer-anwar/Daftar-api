import { IsString } from 'class-validator';
import { BaseTransactionDto } from './base-transaction.dto';

export class CreateExpenseDto extends BaseTransactionDto {
  @IsString()
  repeat!: 'monthly' | 'one-time';
}
