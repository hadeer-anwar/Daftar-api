import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

function parseActiveQueryValue(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

export class RecurringTransactionsQueryDto {
  @IsOptional()
  @IsIn(['INCOME', 'EXPENSE'])
  type?: 'INCOME' | 'EXPENSE';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseActiveQueryValue(value))
  @IsBoolean()
  isActive?: boolean;
}
