import { Types } from 'mongoose';
import { validate } from 'class-validator';

import { UsersRepository } from '../users/repositories/users.repository';
import { TransactionRepository } from '../transactions/repositories/transactions.repository';
import {
  IncomeType,
  Transaction,
  TransactionType,
} from '../transactions/schemas/transactions.schema';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
import { TransactionService } from '../transactions/transactions.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { RecurringFrequency } from './enums/frequency.enum';
import { RecurringTransactionsRepository } from './repositories/recurring-transactions.repository';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { RecurringTransactionDocument } from './schemas/recurring-transaction.schema';

describe('RecurringTransactionsService generation', () => {
  const userId = new Types.ObjectId();
  const ruleId = new Types.ObjectId();
  const firstDate = new Date('2025-01-15T00:00:00.000Z');

  const makeRule = (
    overrides: Partial<RecurringTransactionDocument> = {},
  ): RecurringTransactionDocument =>
    ({
      _id: ruleId,
      id: ruleId.toString(),
      userId,
      amount: 25,
      type: TransactionType.EXPENSE,
      incomeType: undefined,
      customIncomeType: undefined,
      categoryId: 'groceries',
      frequency: RecurringFrequency.MONTHLY,
      startDate: firstDate,
      nextRunDate: firstDate,
      isActive: true,
      repeatMonths: 1,
      generatedCount: 0,
      notes: 'scheduled',
      ...overrides,
    }) as RecurringTransactionDocument;

  const cloneRule = (rule: RecurringTransactionDocument) =>
    ({
      ...rule,
      nextRunDate: rule.nextRunDate
        ? new Date(rule.nextRunDate)
        : rule.nextRunDate,
      lastGeneratedAt: rule.lastGeneratedAt
        ? new Date(rule.lastGeneratedAt)
        : rule.lastGeneratedAt,
    }) as RecurringTransactionDocument;

  const setup = (initialRule = makeRule()) => {
    let persistedRule = cloneRule(initialRule);
    let persistedTransactions: Transaction[] = [];
    let balances = { income: 0, expense: 0 };
    let transactionQueue = Promise.resolve();
    const session = {
      withTransaction: jest.fn(
        async <T>(callback: () => Promise<T>): Promise<T> => {
          const previousTransaction = transactionQueue;
          let releaseTransaction!: () => void;
          transactionQueue = new Promise<void>((resolve) => {
            releaseTransaction = resolve;
          });
          await previousTransaction;

          const beforeTransaction = cloneRule(persistedRule);
          const beforeTransactions = [...persistedTransactions];
          const beforeBalances = { ...balances };
          try {
            return await callback();
          } catch (error) {
            persistedRule = beforeTransaction;
            persistedTransactions = beforeTransactions;
            balances = beforeBalances;
            throw error;
          } finally {
            releaseTransaction();
          }
        },
      ),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      startSession: jest.fn().mockResolvedValue(session),
    };
    const recurringRepository = {
      findDueTransactions: jest.fn(() =>
        Promise.resolve([cloneRule(persistedRule)]),
      ),
      findById: jest.fn(() => Promise.resolve(cloneRule(persistedRule))),
      updateGenerationState: jest.fn(
        (
          _id: Types.ObjectId,
          expected: {
            nextRunDate: Date;
            generatedCount: number;
            repeatMonths?: number | null;
          },
          update: Partial<RecurringTransactionDocument>,
        ): Promise<RecurringTransactionDocument | null> => {
          const current = persistedRule;
          if (
            !current.isActive ||
            current.nextRunDate?.getTime() !== expected.nextRunDate.getTime() ||
            (current.generatedCount ?? 0) !== expected.generatedCount ||
            current.repeatMonths !== expected.repeatMonths
          ) {
            return Promise.resolve(null);
          }
          persistedRule = {
            ...current,
            ...update,
          } as RecurringTransactionDocument;
          return Promise.resolve(cloneRule(persistedRule));
        },
      ),
      getPersistedRule: (): RecurringTransactionDocument => persistedRule,
    };
    const transactionRepository = {
      existsRecurringTransaction: jest.fn(
        (recurringId: Types.ObjectId, date: Date) =>
          Promise.resolve(
            persistedTransactions.some(
              (transaction) =>
                transaction.recurringId?.toString() ===
                  recurringId.toString() &&
                transaction.date?.getTime() === date.getTime(),
            ),
          ),
      ),
      create: jest.fn((data: Partial<Transaction>) => {
        const transaction = {
          _id: new Types.ObjectId(),
          ...data,
        } as Transaction;
        persistedTransactions.push(transaction);
        return Promise.resolve(transaction);
      }),
    };
    const usersRepository = {
      updateBalances: jest.fn(
        (_userId: string, incomeDelta = 0, expenseDelta = 0) => {
          balances.income += incomeDelta;
          balances.expense += expenseDelta;
          return Promise.resolve(undefined);
        },
      ),
    };
    const service = new RecurringTransactionsService(
      recurringRepository as unknown as RecurringTransactionsRepository,
      transactionRepository as unknown as TransactionRepository,
      usersRepository as unknown as UsersRepository,
      connection as never,
    );

    return {
      service,
      session,
      recurringRepository,
      transactionRepository,
      usersRepository,
      getPersistedRule: recurringRepository.getPersistedRule,
      getPersistedTransactions: () => persistedTransactions,
      getBalances: () => balances,
    };
  };

  it('generates a monthly expense and updates the expense balance in-session', async () => {
    const harness = setup();

    const generated = await harness.service.generateDueTransactions(
      userId.toString(),
    );

    expect(generated).toHaveLength(1);
    expect(harness.transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 25,
        transactionType: TransactionType.EXPENSE,
        recurringId: ruleId,
        date: firstDate,
      }),
      harness.session,
    );
    expect(harness.usersRepository.updateBalances).toHaveBeenCalledWith(
      userId.toString(),
      0,
      25,
      harness.session,
    );
    expect(harness.session.withTransaction).toHaveBeenCalledTimes(1);
    expect(harness.session.endSession).toHaveBeenCalledTimes(1);
  });

  it('generates a monthly income and updates the income balance in-session', async () => {
    const harness = setup(
      makeRule({
        type: TransactionType.INCOME,
        incomeType: IncomeType.SALARY,
        categoryId: undefined,
      }),
    );

    const generated = await harness.service.generateDueTransactions(
      userId.toString(),
    );

    expect(generated).toHaveLength(1);
    expect(harness.usersRepository.updateBalances).toHaveBeenCalledWith(
      userId.toString(),
      25,
      0,
      harness.session,
    );
  });

  it('propagates balance failures so the MongoDB transaction aborts', async () => {
    const harness = setup();
    harness.usersRepository.updateBalances.mockRejectedValue(
      new Error('balance update failed'),
    );

    await expect(
      harness.service.generateDueTransactions(userId.toString()),
    ).rejects.toThrow('balance update failed');

    expect(harness.transactionRepository.create).toHaveBeenCalledTimes(1);
    expect(harness.session.endSession).toHaveBeenCalledTimes(1);
    expect(harness.getPersistedRule().generatedCount).toBe(0);
  });

  it('does not create an occurrence when the recurring-state write fails', async () => {
    const harness = setup();
    harness.recurringRepository.updateGenerationState.mockRejectedValue(
      new Error('recurrence write failed'),
    );

    await expect(
      harness.service.generateDueTransactions(userId.toString()),
    ).rejects.toThrow('recurrence write failed');

    expect(harness.transactionRepository.create).not.toHaveBeenCalled();
  });

  it('rolls back an earlier catch-up occurrence if later recurrence persistence fails', async () => {
    const harness = setup(makeRule({ repeatMonths: 2 }));
    const persistState =
      harness.recurringRepository.updateGenerationState.getMockImplementation();
    if (!persistState) {
      throw new Error('Expected recurrence-state mock implementation');
    }
    harness.recurringRepository.updateGenerationState
      .mockImplementationOnce(persistState)
      .mockRejectedValueOnce(new Error('recurrence write failed'));

    await expect(
      harness.service.generateDueTransactions(userId.toString()),
    ).rejects.toThrow('recurrence write failed');

    expect(harness.transactionRepository.create).toHaveBeenCalledTimes(1);
    expect(harness.usersRepository.updateBalances).toHaveBeenCalledTimes(1);
    expect(harness.getPersistedRule().generatedCount).toBe(0);
    expect(harness.getPersistedRule().nextRunDate).toEqual(firstDate);
    expect(harness.getPersistedTransactions()).toHaveLength(0);
    expect(harness.getBalances()).toEqual({ income: 0, expense: 0 });
  });

  it('aborts after a conflict following a catch-up occurrence, then retries from fresh rule state', async () => {
    const harness = setup(makeRule({ repeatMonths: 3 }));
    const persistState =
      harness.recurringRepository.updateGenerationState.getMockImplementation();
    if (!persistState) {
      throw new Error('Expected recurrence-state mock implementation');
    }
    harness.recurringRepository.updateGenerationState
      .mockImplementationOnce(persistState)
      .mockResolvedValueOnce(null)
      .mockImplementation(persistState);

    const generated = await harness.service.generateDueTransactions(
      userId.toString(),
    );

    expect(generated).toHaveLength(3);
    expect(harness.session.withTransaction).toHaveBeenCalledTimes(2);
    expect(harness.recurringRepository.findById).toHaveBeenCalledTimes(2);
    expect(harness.getPersistedTransactions()).toHaveLength(3);
    expect(harness.getBalances()).toEqual({ income: 0, expense: 75 });
    expect(harness.getPersistedRule().generatedCount).toBe(3);
    expect(harness.getPersistedRule().isActive).toBe(false);
  });

  it('stops after the bounded number of repeated state conflicts', async () => {
    const harness = setup(makeRule({ repeatMonths: 3 }));
    harness.recurringRepository.updateGenerationState.mockResolvedValue(null);

    await expect(
      harness.service.generateDueTransactions(userId.toString()),
    ).rejects.toThrow('Recurring transaction state changed during generation');

    expect(harness.session.withTransaction).toHaveBeenCalledTimes(3);
    expect(harness.recurringRepository.findById).toHaveBeenCalledTimes(3);
    expect(harness.transactionRepository.create).not.toHaveBeenCalled();
    expect(harness.getPersistedTransactions()).toHaveLength(0);
    expect(harness.getBalances()).toEqual({ income: 0, expense: 0 });
    expect(harness.session.endSession).toHaveBeenCalledTimes(1);
  });

  it('retries a duplicate-key occurrence without applying its balance twice', async () => {
    const harness = setup();
    harness.transactionRepository.create
      .mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), {
          code: 11000,
          keyPattern: { recurringId: 1, date: 1 },
        }),
      )
      .mockResolvedValueOnce(undefined);
    harness.transactionRepository.existsRecurringTransaction
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const generated = await harness.service.generateDueTransactions(
      userId.toString(),
    );

    expect(generated).toHaveLength(0);
    expect(harness.session.withTransaction).toHaveBeenCalledTimes(2);
    expect(harness.usersRepository.updateBalances).not.toHaveBeenCalled();
    expect(harness.getPersistedRule().generatedCount).toBe(1);
  });

  it('advances an already-existing occurrence without changing the balance', async () => {
    const harness = setup();
    harness.transactionRepository.existsRecurringTransaction.mockResolvedValue(
      true,
    );

    const generated = await harness.service.generateDueTransactions(
      userId.toString(),
    );

    expect(generated).toHaveLength(0);
    expect(harness.transactionRepository.create).not.toHaveBeenCalled();
    expect(harness.usersRepository.updateBalances).not.toHaveBeenCalled();
    expect(harness.getPersistedRule().generatedCount).toBe(1);
  });

  it('deactivates the rule after its final allowed occurrence', async () => {
    const harness = setup();

    await harness.service.generateDueTransactions(userId.toString());

    expect(harness.getPersistedRule().generatedCount).toBe(1);
    expect(harness.getPersistedRule().isActive).toBe(false);
  });

  it('catches up missed occurrences without exceeding the configured limit', async () => {
    const harness = setup(
      makeRule({
        repeatMonths: 3,
      }),
    );

    const generated = await harness.service.generateDueTransactions(
      userId.toString(),
    );

    expect(generated).toHaveLength(3);
    expect(harness.transactionRepository.create).toHaveBeenCalledTimes(3);
    expect(harness.getPersistedRule().generatedCount).toBe(3);
    expect(harness.getPersistedRule().isActive).toBe(false);
  });

  it('allows only one concurrent attempt to claim the same scheduled occurrence', async () => {
    const harness = setup();

    const results = await Promise.all([
      harness.service.generateDueTransactions(userId.toString()),
      harness.service.generateDueTransactions(userId.toString()),
    ]);

    expect(results.flat()).toHaveLength(1);
    expect(harness.transactionRepository.create).toHaveBeenCalledTimes(1);
    expect(harness.usersRepository.updateBalances).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, null])(
    'keeps a recurring rule active when repeatMonths is %s',
    async (repeatMonths) => {
      const recentDueDate = new Date();
      recentDueDate.setMonth(recentDueDate.getMonth() - 1);
      const harness = setup(
        makeRule({
          nextRunDate: recentDueDate,
          repeatMonths,
          generatedCount: 0,
        }),
      );

      const generated = await harness.service.generateDueTransactions(
        userId.toString(),
      );

      expect(generated.length).toBeGreaterThan(0);
      expect(harness.getPersistedRule().isActive).toBe(true);
      expect(harness.getPersistedRule().generatedCount).toBe(generated.length);
    },
  );

  it('treats a missing legacy generatedCount as zero when the limit is finite', async () => {
    const harness = setup(
      makeRule({
        repeatMonths: 2,
        generatedCount: undefined,
      }),
    );

    const generated = await harness.service.generateDueTransactions(
      userId.toString(),
    );

    expect(generated).toHaveLength(2);
    expect(harness.getPersistedRule().generatedCount).toBe(2);
  });

  it('keeps one-time transaction creation independent of recurring sessions', async () => {
    const transaction = {
      _id: new Types.ObjectId(),
      amount: 25,
      transactionType: TransactionType.EXPENSE,
    } as Transaction;
    const transactionRepository = {
      create: jest.fn().mockResolvedValue(transaction),
    };
    const usersRepository = {
      findById: jest.fn().mockResolvedValue({ _id: userId }),
      updateBalances: jest.fn().mockResolvedValue(undefined),
    };
    const recurringService = { create: jest.fn() };
    const recurringRepository = { findActiveSalaryByUser: jest.fn() };
    const service = new TransactionService(
      transactionRepository as unknown as TransactionRepository,
      usersRepository as unknown as UsersRepository,
      recurringService as never,
      recurringRepository as never,
    );

    await service.create(userId.toString(), {
      transactionType: TransactionType.EXPENSE,
      amount: 25,
      categoryId: 'groceries',
      date: firstDate.toISOString(),
      repeat: 'one-time',
    });

    expect(transactionRepository.create).toHaveBeenCalledTimes(1);
    expect(transactionRepository.create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        amount: 25,
        transactionType: TransactionType.EXPENSE,
        recurringId: null,
      }),
    );
    expect(usersRepository.updateBalances).toHaveBeenCalledWith(
      userId.toString(),
      0,
      25,
    );
    expect(recurringService.create).not.toHaveBeenCalled();
  });

  it('validates repeatMonths as optional but enforces the range when supplied', async () => {
    const dto = new CreateRecurringTransactionDto();
    Object.assign(dto, {
      amount: 25,
      type: TransactionType.EXPENSE,
      categoryId: 'groceries',
      frequency: RecurringFrequency.MONTHLY,
      startDate: firstDate.toISOString(),
    });

    expect(await validate(dto)).toHaveLength(0);

    dto.repeatMonths = null;
    expect(await validate(dto)).toHaveLength(0);

    dto.repeatMonths = 0;
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('allows transaction creation without a repeatMonths limit', async () => {
    const dto = new CreateTransactionDto();
    Object.assign(dto, {
      amount: 25,
      transactionType: TransactionType.EXPENSE,
      categoryId: 'groceries',
      repeat: 'monthly',
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
