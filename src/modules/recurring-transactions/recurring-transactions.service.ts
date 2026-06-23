import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import {
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

  async update(
    userId: string,
    id: string,
    data: Partial<RecurringTransaction>,
  ) {
    const rule = await this.findById(userId, id);
    if (!rule) {
      throw new NotFoundException('Recurring transaction not found');
    }
    return this.recurringRepository.update(id, data);
  }

  async deactivate(id: string) {
    return this.recurringRepository.update(id, { isActive: false });
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
