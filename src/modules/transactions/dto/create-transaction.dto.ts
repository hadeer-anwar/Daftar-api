import { CreateExpenseDto } from './create-expense.dto';
import { CreateIncomeDto } from './create-income.dto';

export type CreateTransactionDto = CreateIncomeDto | CreateExpenseDto;
