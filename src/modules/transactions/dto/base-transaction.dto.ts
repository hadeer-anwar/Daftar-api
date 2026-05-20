import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum TransactionType {
  EXPENSE = 'expense',
  INCOME = 'income',
}

export class BaseTransactionDto {
  @IsNumber()
  amount!: number;

  @IsString()
  categoryId!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsEnum(TransactionType)
  transactionType!: TransactionType;
}
