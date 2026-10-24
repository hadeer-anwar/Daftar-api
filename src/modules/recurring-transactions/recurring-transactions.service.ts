import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';

import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import {
  IncomeType,
  Transaction,
  TransactionType,
} from '../transactions/schemas/transactions.schema';

import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { RecurringTransactionsQueryDto } from './dto/recurring-transactions-query.dto';
import { RecurringTransactionsRepository } from './repositories/recurring-transactions.repository';
import {
  RecurringTransaction,
  RecurringTransactionDocument,
} from './schemas/recurring-transaction.schema';
import { calculateNextRunDate } from './utils/calculate-next-run-date.util';
import { UsersRepository } from '../users/repositories/users.repository';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { RecurringFrequency } from './enums/frequency.enum';

const MAX_GENERATION_ATTEMPTS = 3;

class RecurringGenerationConflictError extends Error {
  constructor() {
    super('Recurring transaction state changed during generation');
    this.name = RecurringGenerationConflictError.name;
  }
}

@Injectable()
export class RecurringTransactionsService {
  private readonly logger = new Logger(RecurringTransactionsService.name);

  constructor(
    private readonly recurringRepository: RecurringTransactionsRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly usersRepository: UsersRepository,
    @InjectConnection()
    private readonly connection: Connection,
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
      categoryId: dto.categoryId,
      repeatMonths: dto.repeatMonths,
      generatedCount: 0,
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
    const session = await this.connection.startSession();

    try {
      for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        try {
          return (
            (await session.withTransaction(async () => {
              const created: Transaction[] = [];
              let current = await this.recurringRepository.findById(
                rule._id.toString(),
                session,
              );

              if (
                !current ||
                current.userId.toString() !== rule.userId.toString() ||
                !current.isActive ||
                !current.nextRunDate ||
                current.nextRunDate > now
              ) {
                return created;
              }

              while (
                current.isActive &&
                current.nextRunDate &&
                current.nextRunDate <= now
              ) {
                const generatedCount = current.generatedCount ?? 0;
                const repeatMonths = current.repeatMonths;
                const expected = {
                  nextRunDate: new Date(current.nextRunDate),
                  generatedCount,
                  repeatMonths,
                };

                if (
                  repeatMonths != null &&
                  (!Number.isInteger(repeatMonths) ||
                    repeatMonths < 1 ||
                    repeatMonths > 120)
                ) {
                  await this.updateGenerationStateOrThrow(
                    current._id,
                    expected,
                    { generatedCount, isActive: false },
                    session,
                  );
                  break;
                }

                if (repeatMonths != null && generatedCount >= repeatMonths) {
                  await this.updateGenerationStateOrThrow(
                    current._id,
                    expected,
                    { isActive: false },
                    session,
                  );
                  break;
                }

                const runDate = new Date(current.nextRunDate);
                const alreadyExists =
                  await this.transactionRepository.existsRecurringTransaction(
                    current._id,
                    runDate,
                    session,
                  );

                const nextGeneratedCount = generatedCount + 1;
                const reachedLimit =
                  repeatMonths != null && nextGeneratedCount >= repeatMonths;
                const progress: Partial<RecurringTransaction> = {
                  generatedCount: nextGeneratedCount,
                  lastGeneratedAt: runDate,
                  isActive: !reachedLimit,
                };
                if (!reachedLimit) {
                  progress.nextRunDate = calculateNextRunDate(
                    runDate,
                    current.frequency,
                  );
                }

                // This conditional write serializes workers on the rule. It
                // is part of this transaction, so failed later writes restore
                // the previous recurrence state.
                const advanced = await this.updateGenerationStateOrThrow(
                  current._id,
                  expected,
                  progress,
                  session,
                );

                if (!alreadyExists) {
                  const transaction = await this.transactionRepository.create(
                    {
                      userId: current.userId,
                      amount: current.amount,
                      transactionType: current.type,
                      incomeType: current.incomeType,
                      customIncomeType: current.customIncomeType,
                      categoryId: current.categoryId,
                      date: runDate,
                      recurringId: current._id,
                      notes: current.notes,
                    },
                    session,
                  );

                  await this.usersRepository.updateBalances(
                    current.userId.toString(),
                    transaction.transactionType === TransactionType.INCOME
                      ? transaction.amount
                      : 0,
                    transaction.transactionType === TransactionType.EXPENSE
                      ? transaction.amount
                      : 0,
                    session,
                  );
                  created.push(transaction);
                }

                current = advanced;
              }

              return created;
            })) ?? []
          );
        } catch (err: unknown) {
          const retryable =
            err instanceof RecurringGenerationConflictError ||
            this.isRecurringOccurrenceDuplicate(err);
          if (retryable && attempt + 1 < MAX_GENERATION_ATTEMPTS) {
            if (this.isRecurringOccurrenceDuplicate(err)) {
              this.logger.warn(
                `Concurrent duplicate recurring transaction retried for rule ${rule.id}`,
              );
            }
            continue;
          }
          throw err;
        }
      }

      return [];
    } finally {
      await session.endSession();
    }
  }

  private async updateGenerationStateOrThrow(
    id: Types.ObjectId,
    expected: {
      nextRunDate: Date;
      generatedCount: number;
      repeatMonths?: number | null;
    },
    data: Partial<RecurringTransaction>,
    session: ClientSession,
  ): Promise<RecurringTransactionDocument> {
    const updated = await this.recurringRepository.updateGenerationState(
      id,
      expected,
      data,
      session,
    );
    if (!updated) {
      throw new RecurringGenerationConflictError();
    }
    return updated;
  }

  async findByUserId(
    userId: string,
    filters: RecurringTransactionsQueryDto = {},
  ) {
    return this.recurringRepository.findByUserId(userId, {
      type:
        filters.type === 'INCOME'
          ? TransactionType.INCOME
          : filters.type === 'EXPENSE'
            ? TransactionType.EXPENSE
            : undefined,
      isActive: filters.isActive,
    });
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

  private isRecurringOccurrenceDuplicate(err: unknown): boolean {
    if (
      typeof err !== 'object' ||
      err === null ||
      !('code' in err) ||
      (err as { code?: number }).code !== 11000
    ) {
      return false;
    }

    const duplicate = err as {
      keyPattern?: Record<string, unknown>;
      message?: string;
    };
    return (
      (duplicate.keyPattern?.recurringId === 1 &&
        duplicate.keyPattern?.date === 1) ||
      duplicate.message?.includes('recurringId_1_date_1') === true
    );
  }
}

export type { RecurringTransaction };
