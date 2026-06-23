import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { TransactionRepository } from './repositories/transactions.repository';
import { UsersRepository } from '../users/repositories/users.repository';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';
import { RecurringFrequency } from '../recurring-transactions/enums/frequency.enum';

import { TransactionType, IncomeType } from './schemas/transactions.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { RecurringTransactionsRepository } from '../recurring-transactions/repositories/recurring-transactions.repository';
import { normalizeToDay } from '../../common/utils/normalize-date';

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly usersRepository: UsersRepository,
    private readonly recurringService: RecurringTransactionsService,
    private readonly recurringRepository: RecurringTransactionsRepository,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const effectiveDate: Date =
      dto.transactionType === TransactionType.INCOME
        ? new Date(dto.payDate ?? new Date())
        : new Date(dto.date ?? new Date());

    let recurringId: Types.ObjectId | null = null;
    if (dto.repeat === 'monthly') {
      if (
        dto.transactionType === TransactionType.INCOME &&
        dto.incomeType === IncomeType.SALARY
      ) {
        const existingSalaryRule =
          await this.recurringRepository.findActiveSalaryByUser(userId);
        if (existingSalaryRule) {
          throw new ForbiddenException(
            'An active monthly salary rule already exists for this user',
          );
        }
      }
      const recurring = await this.recurringService.create(userId, {
        amount: dto.amount,
        type: dto.transactionType,
        incomeType: dto.incomeType as IncomeType,
        frequency: RecurringFrequency.MONTHLY,
        startDate: effectiveDate.toISOString(),
        notes: dto.notes,
      });
      recurringId = recurring._id;

      // Check if we also need to generate a transaction immediately
      const now = new Date();
      if (normalizeToDay(effectiveDate) <= normalizeToDay(now)) {
        await this.recurringService.sync(userId);
      }

      return recurring;
    }
    const transaction = await this.transactionRepository.create({
      userId: new Types.ObjectId(userId),
      amount: dto.amount,
      transactionType: dto.transactionType,
      categoryId: dto.categoryId,
      notes: dto.notes,
      incomeType: dto.incomeType as IncomeType | undefined,
      date: effectiveDate,
      recurringId: recurringId || null,
    });

    if (transaction.transactionType === TransactionType.INCOME) {
      await this.usersRepository.updateBalances(userId, transaction.amount, 0);
    } else {
      await this.usersRepository.updateBalances(userId, 0, transaction.amount);
    }

    return transaction;
  }

  async findAllByUser(userId: string) {
    return this.transactionRepository.findAllByUser(userId);
  }

  async findWithFilters(userId: string, filterDto: FilterTransactionDto) {
    return this.transactionRepository.findWithFilters(userId, filterDto);
  }

  async findActiveSalaryByUser(userId: string) {
    return this.recurringRepository.findActiveSalaryByUser(userId);
  }

  // update transaction history (amount, date, notes, category, incomeType)
  async update(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    // ── 1. Fetch + authorize in one query ─────────────────────────────────────
    const transaction = await this.transactionRepository.findByIdAndUser(
      transactionId,
      userId,
    );

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // ── 2. Compute effective state ────────────────────────────────────────────
    const currentDate = new Date(transaction.date);

    const effective = {
      amount: dto.amount ?? transaction.amount,
      transactionType: dto.transactionType ?? transaction.transactionType,
      categoryId: dto.categoryId ?? transaction.categoryId,
      incomeType: (dto.incomeType ?? transaction.incomeType) as IncomeType,
      notes: dto.notes ?? transaction.notes,
      date: transaction.date, // will be overridden below if dto has date/payDate
    };

    const isIncome = effective.transactionType === TransactionType.INCOME;

    const rawDate = isIncome
      ? (dto.payDate ?? currentDate.toISOString())
      : (dto.date ?? currentDate.toISOString());

    const effectiveDate = new Date(rawDate);
    effective.date = effectiveDate;

    const oldType = transaction.transactionType;
    const oldAmount = transaction.amount;

    const newType = effective.transactionType;
    const newAmount = effective.amount;

    if (oldType === newType) {
      const diff = newAmount - oldAmount;

      if (newType === TransactionType.INCOME) {
        await this.usersRepository.updateBalances(userId, diff, 0);
      } else {
        await this.usersRepository.updateBalances(userId, 0, diff);
      }
    } else {
      let incomeDelta = 0;
      let expenseDelta = 0;

      // Undo old transaction
      if (oldType === TransactionType.INCOME) {
        incomeDelta -= oldAmount;
      } else {
        expenseDelta -= oldAmount;
      }

      // Apply new transaction
      if (newType === TransactionType.INCOME) {
        incomeDelta += newAmount;
      } else {
        expenseDelta += newAmount;
      }

      await this.usersRepository.updateBalances(
        userId,
        incomeDelta,
        expenseDelta,
      );
    }
    return this.transactionRepository.updateById(transactionId, effective);
  }

  async delete(userId: string, transactionId: string) {
    const transaction = await this.transactionRepository.findByIdAndUser(
      transactionId,
      userId,
    );
    if (!transaction) throw new NotFoundException('Transaction not found');

    const amount = transaction.amount;
    if (transaction.transactionType === TransactionType.INCOME) {
      await this.usersRepository.updateBalances(userId, -amount, 0);
    } else {
      await this.usersRepository.updateBalances(userId, 0, -amount);
    }

    await this.transactionRepository.deleteById(transactionId);

    return { message: 'Transaction deleted successfully' };
  }

  async getBalanceSummary(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      totalIncome: user.totalIncome,
      totalExpense: user.totalExpense,
      totalBalance: user.totalIncome - user.totalExpense,
    };
  }
}
