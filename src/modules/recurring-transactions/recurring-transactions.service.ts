import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import {
  IncomeType,
  Transaction,
  TransactionType,
} from '../transactions/schemas/transactions.schema';

import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { RecurringTransactionsRepository } from './repositories/recurring-transactions.repository';
import {
  RecurringTransaction,
  RecurringTransactionDocument,
} from './schemas/recurring-transaction.schema';
import { calculateNextRunDate } from './utils/calculate-next-run-date.util';
import { UsersRepository } from '../users/repositories/users.repository';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { RecurringFrequency } from './enums/frequency.enum';

@Injectable()
export class RecurringTransactionsService {
  private readonly logger = new Logger(RecurringTransactionsService.name);

  constructor(
    private readonly recurringRepository: RecurringTransactionsRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async create(userId: string, dto: CreateRecurringTransactionDto) {
    const startDate = new Date(dto.startDate);
    const userObjectId = new Types.ObjectId(userId);
    const rule = await this.recurringRepository.create({
      userId: userObjectId,
      amount: dto.amount,
      type: dto.type,
      incomeType: dto.incomeType,
      customIncomeType: dto.customIncomeType,
      frequency: dto.frequency,
      startDate,
      nextRunDate: startDate,
      isActive: true,
      notes: dto.notes,
    });

    return rule;
  }

  /**
   * Find every active recurring rule whose nextRunDate is in the past
   * and generate the missing transactions up to "now". The loop catches up
   * any number of missed cycles in a single pass.
   */
  async generateDueTransactions(userId: string): Promise<Transaction[]> {
    const now = new Date();
    const dueRules = await this.recurringRepository.findDueTransactions(
      userId,
      now,
    );

    const generated: Transaction[] = [];

    for (const rule of dueRules) {
      const created = await this.generateForRule(rule, now);
      generated.push(...created);
    }

    return generated;
  }

  private async generateForRule(
    rule: RecurringTransactionDocument,
    now: Date,
  ): Promise<Transaction[]> {
    const created: Transaction[] = [];

    while (rule.nextRunDate && rule.nextRunDate <= now) {
      const runDate = new Date(rule.nextRunDate);
      const alreadyExists =
        await this.transactionRepository.existsRecurringTransaction(
          rule._id,
          runDate,
        );

      if (!alreadyExists) {
        try {
          const transaction = await this.transactionRepository.create({
            userId: rule.userId,
            amount: rule.amount,
            transactionType: rule.type,
            incomeType: rule.incomeType,
            customIncomeType: rule.customIncomeType,
            categoryId: rule.categoryId,
            date: runDate,
            recurringId: rule._id,
            notes: rule.notes,
          });
          // update user balance
          if (transaction.transactionType === TransactionType.INCOME) {
            await this.usersRepository.updateBalances(
              rule.userId.toString(),
              transaction.amount,
              0,
            );
          } else {
            await this.usersRepository.updateBalances(
              rule.userId.toString(),
              0,
              transaction.amount,
            );
          }
          created.push(transaction);
        } catch (err: unknown) {
          // Unique index on { recurringId, date } can race; treat as duplicate.
          if (this.isDuplicateKeyError(err)) {
            this.logger.warn(
              `Duplicate recurring transaction skipped for rule ${rule.id} at ${runDate.toISOString()}`,
            );
          } else {
            throw err;
          }
        }
      }

      rule.lastGeneratedAt = runDate;
      rule.nextRunDate = calculateNextRunDate(runDate, rule.frequency);
    }

    await this.recurringRepository.save(rule);
    return created;
  }

  async findByUserId(userId: string) {
    return this.recurringRepository.findByUserId(userId);
  }

  async findById(userId: string, id: string) {
    const rule = await this.recurringRepository.findById(id);
    if (!rule || rule.userId.toString() !== userId) {
      throw new NotFoundException('Recurring transaction not found');
    }
    return rule;
  }

  async update(userId: string, id: string, dto: UpdateRecurringTransactionDto) {
    const rule = await this.findById(userId, id);

    const {
      dayOfMonth,
      amount,
      categoryId,
      notes,
      incomeType,
      customIncomeType,
    } = dto;

    const patch: Partial<RecurringTransaction> = {};

    if (amount !== undefined) patch.amount = amount;
    if (categoryId !== undefined) patch.categoryId = categoryId;
    if (notes !== undefined) patch.notes = notes;
    if (incomeType !== undefined) {
      patch.incomeType = incomeType;
      if (incomeType !== IncomeType.OTHER) {
        patch.customIncomeType = undefined;
      }
    }
    if (customIncomeType !== undefined)
      patch.customIncomeType = customIncomeType;

    // ── dayOfMonth → nextRunDate ─────────────────────────────────────────────
    if (dayOfMonth !== undefined) {
      if (rule.frequency !== RecurringFrequency.MONTHLY) {
        throw new BadRequestException(
          'dayOfMonth can only be set on monthly recurring rules.',
        );
      }

      patch.nextRunDate = this.computeNextRunDateForDay(
        rule.nextRunDate,
        dayOfMonth,
      );
    }

    return this.recurringRepository.update(id, patch);
  }

  private computeNextRunDateForDay(
    currentNextRunDate: Date,
    targetDay: number,
  ): Date {
    const now = new Date();

    // Start from the month of the current nextRunDate.
    const candidate = new Date(currentNextRunDate);
    candidate.setDate(targetDay);
    // Reset to midnight UTC to avoid time-of-day comparisons.
    candidate.setHours(0, 0, 0, 0);

    // If the candidate has already passed, push to the same day next month.
    if (candidate <= now) {
      candidate.setMonth(candidate.getMonth() + 1);

      // Guard against month-end overflow (e.g. March 31 → April 31 → May 1).
      // Since dayOfMonth is capped at 28 in the DTO this branch is purely
      // defensive, but it's cheap and safe to keep.
      if (candidate.getDate() !== targetDay) {
        candidate.setDate(0); // last day of the previous month
      }
    }

    return candidate;
  }

  async deactivate(id: string) {
    return this.recurringRepository.update(id, { isActive: false });
  }

  async delete(userId: string, id: string) {
    const rule = await this.findById(userId, id);
    if (!rule) {
      throw new NotFoundException('Recurring transaction not found');
    }
    return this.recurringRepository.delete(id);
  }

  async sync(userId: string): Promise<void> {
    const hasDueTransactions =
      await this.recurringRepository.hasDueTransactions(userId, new Date());

    if (!hasDueTransactions) {
      return;
    }

    await this.generateDueTransactions(userId);
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: number }).code === 11000
    );
  }
}

export type { RecurringTransaction };
