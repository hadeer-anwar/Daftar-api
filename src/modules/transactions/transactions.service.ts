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

import {
  TransactionType,
  Transaction,
  IncomeType,
} from './schemas/transactions.schema';
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
        await this.recurringService.generateDueTransactions(userId);
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
      repeat: dto.repeat,
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

  // async update(
  //   userId: string,
  //   transactionId: string,
  //   dto: UpdateTransactionDto,
  // ) {
  //   // ── 1. Fetch + authorize in one query ─────────────────────────────────────
  //   const transaction = await this.transactionRepository.findByIdAndUser(
  //     transactionId,
  //     userId,
  //   );

  //   if (!transaction) {
  //     throw new NotFoundException('Transaction not found');
  //   }

  //   // ── 2. Compute effective state ────────────────────────────────────────────
  //   const now = new Date();
  //   const currentDate = new Date(transaction.date);

  //   const effective = {
  //     amount: dto.amount ?? transaction.amount,
  //     transactionType: dto.transactionType ?? transaction.transactionType,
  //     categoryId: dto.categoryId ?? transaction.categoryId,
  //     incomeType: dto.incomeType ?? transaction.incomeType,
  //     notes: dto.notes ?? transaction.notes,
  //     repeat: dto.repeat ?? transaction.repeat,
  //   };

  //   const isIncome = effective.transactionType === TransactionType.INCOME;

  //   const rawDate = isIncome
  //     ? (dto.payDate ?? currentDate.toISOString())
  //     : (dto.date ?? currentDate.toISOString());

  //   const effectiveDate = new Date(rawDate);

  //   const dateChanged = effectiveDate.getTime() !== currentDate.getTime();

  //   const oldRepeat = transaction.repeat;
  //   const newRepeat = effective.repeat;

  //   const wasRecurring = oldRepeat === 'monthly';
  //   const willRecurring = newRepeat === 'monthly';

  //   const recurringNeedsUpdate =
  //     dateChanged || dto.amount != null || dto.notes != null;

  //   let recurringId = transaction.recurringId ?? null;

  //   // ── 3. Handle recurring transition ───────────────────────────────────────
  //   if (wasRecurring && !willRecurring && recurringId) {
  //     // recurring → one-time
  //     await this.recurringService.deactivate(recurringId.toString());

  //     recurringId = null;
  //   } else if (!wasRecurring && willRecurring) {
  //     // one-time → recurring
  //     const recurring = await this.recurringService.create(userId, {
  //       amount: effective.amount,
  //       type: effective.transactionType,
  //       frequency: RecurringFrequency.MONTHLY,
  //       startDate: effectiveDate.toISOString(),
  //       notes: effective.notes,
  //     });

  //     recurringId = recurring._id;
  //   } else if (
  //     wasRecurring &&
  //     willRecurring &&
  //     recurringId &&
  //     recurringNeedsUpdate
  //   ) {
  //     // recurring → recurring update
  //     await this.recurringRepository.update(recurringId.toString(), {
  //       ...(dateChanged && {
  //         startDate: effectiveDate,
  //         nextRunDate: effectiveDate,
  //       }),

  //       ...(dto.amount != null && {
  //         amount: dto.amount,
  //       }),

  //       ...(dto.notes != null && {
  //         notes: dto.notes,
  //       }),
  //     });
  //   }

  //   // ── 4. Recalculate applied state ──────────────────────────────────────────
  //   const isApplied = normalizeToDay(effectiveDate) <= normalizeToDay(now);
  //   // console.log('Effective Date:', effectiveDate);
  //   // console.log('Now:', now);
  //   // console.log('Is Applied:', isApplied);

  //   // ── 5. Build optimized update payload ────────────────────────────────────
  //   const updatePayload: Partial<Transaction> = {
  //     recurringId,
  //     repeat: newRepeat,
  //     date: effectiveDate,
  //     isApplied,
  //   };

  //   if (dto.amount != null) {
  //     updatePayload.amount = dto.amount;
  //   }

  //   if (dto.transactionType) {
  //     updatePayload.transactionType = dto.transactionType;
  //   }

  //   if (dto.categoryId) {
  //     updatePayload.categoryId = dto.categoryId;
  //   }

  //   if (dto.incomeType) {
  //     updatePayload.incomeType = dto.incomeType;
  //   }

  //   if (dto.notes != null) {
  //     updatePayload.notes = dto.notes;
  //   }

  //   // ── 6. Persist update ─────────────────────────────────────────────────────
  //   return this.transactionRepository.updateById(transactionId, updatePayload);
  // }

  async delete(userId: string, transactionId: string) {
    const transaction =
      await this.transactionRepository.findById(transactionId);
    if (!transaction) throw new NotFoundException('Transaction not found');

    if (transaction.userId?.toString() !== userId) {
      throw new ForbiddenException('Access denied');
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
