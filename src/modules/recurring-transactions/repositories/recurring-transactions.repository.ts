import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import {
  IncomeType,
  TransactionType,
} from '../../transactions/schemas/transactions.schema';
import {
  RecurringTransaction,
  RecurringTransactionDocument,
} from '../schemas/recurring-transaction.schema';

export const SALARY_TITLE = 'Salary';

@Injectable()
export class RecurringTransactionsRepository {
  constructor(
    @InjectModel(RecurringTransaction.name)
    private readonly recurringModel: Model<RecurringTransaction>,
  ) {}

  async create(
    data: Partial<RecurringTransaction>,
  ): Promise<RecurringTransactionDocument> {
    return this.recurringModel.create(data);
  }

  async findById(
    id: string,
    session?: ClientSession,
  ): Promise<RecurringTransactionDocument | null> {
    return this.recurringModel.findById(id, null, { session });
  }

  async findDueTransactions(
    userId: string,
    now: Date = new Date(),
    session?: ClientSession,
  ): Promise<RecurringTransactionDocument[]> {
    let query = this.recurringModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
      nextRunDate: { $lte: now },
    });

    if (session) {
      query = query.session(session);
    }

    return query;
  }

  async findActiveSalaryByUser(
    userId: string,
  ): Promise<RecurringTransactionDocument | null> {
    return this.recurringModel.findOne({
      userId: new Types.ObjectId(userId),
      type: TransactionType.INCOME,
      incomeType: IncomeType.SALARY,
      isActive: true,
    });
  }

  async findByUserId(
    userId: string,
    filters: {
      type?: TransactionType;
      isActive?: boolean;
    } = {},
  ): Promise<RecurringTransactionDocument[]> {
    return this.recurringModel
      .find({
        userId: new Types.ObjectId(userId),
        ...(filters.type !== undefined && { type: filters.type }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      })
      .sort({ nextRunDate: 1 });
  }

  async update(
    id: string,
    data: Partial<RecurringTransaction>,
    session?: ClientSession,
  ): Promise<RecurringTransactionDocument | null> {
    return this.recurringModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true, session },
    );
  }

  async updateGenerationState(
    id: string | Types.ObjectId,
    expected: {
      nextRunDate: Date;
      generatedCount: number;
      repeatMonths?: number | null;
    },
    data: Partial<RecurringTransaction>,
    session: ClientSession,
  ): Promise<RecurringTransactionDocument | null> {
    const filter: Record<string, unknown> = {
      _id: id,
      isActive: true,
      nextRunDate: expected.nextRunDate,
      generatedCount:
        expected.generatedCount === 0
          ? { $in: [0, null] }
          : expected.generatedCount,
      repeatMonths:
        expected.repeatMonths == null ? { $in: [null] } : expected.repeatMonths,
    };

    return this.recurringModel.findOneAndUpdate(
      filter,
      { $set: data },
      { new: true, runValidators: true, session },
    );
  }

  async save(
    doc: RecurringTransactionDocument,
    session?: ClientSession,
  ): Promise<RecurringTransactionDocument> {
    const result = await doc.save(session ? { session } : undefined);
    return result;
  }

  async hasDueTransactions(
    userId: string,
    now: Date,
    session?: ClientSession,
  ): Promise<boolean> {
    let query = this.recurringModel
      .findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
        nextRunDate: { $lte: now },
      })
      .select('_id');

    if (session) {
      query = query.session(session);
    }

    const rule = await query.lean();

    return !!rule;
  }

  async delete(id: string): Promise<void> {
    await this.recurringModel.findByIdAndDelete(id);
  }

  async deleteManyByUserId(userId: string) {
    return this.recurringModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
  }
}
