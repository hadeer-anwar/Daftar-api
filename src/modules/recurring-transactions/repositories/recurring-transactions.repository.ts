import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TransactionType } from '../../transactions/schemas/transactions.schema';
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

  async findById(id: string): Promise<RecurringTransactionDocument | null> {
    return this.recurringModel.findById(id);
  }

  async findDueTransactions(
    userId: string,
    now: Date = new Date(),
  ): Promise<RecurringTransactionDocument[]> {
    return this.recurringModel.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
      nextRunDate: { $lte: now },
    });
  }

  async findActiveSalaryByUser(
    userId: string,
  ): Promise<RecurringTransactionDocument | null> {
    return this.recurringModel.findOne({
      userId: new Types.ObjectId(userId),
      type: TransactionType.INCOME,
      isActive: true,
    });
  }

  async findByUserId(userId: string): Promise<RecurringTransactionDocument[]> {
    return this.recurringModel
      .find({
        userId: new Types.ObjectId(userId),
        isActive: true,
      })
      .sort({ nextRunDate: 1 });
  }

  async update(
    id: string,
    data: Partial<RecurringTransaction>,
  ): Promise<RecurringTransactionDocument | null> {
    return this.recurringModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true },
    );
  }

  async save(
    doc: RecurringTransactionDocument,
  ): Promise<RecurringTransactionDocument> {
    const result = await doc.save();
    return result;
  }

  async hasDueTransactions(userId: string, now: Date): Promise<boolean> {
    const rule = await this.recurringModel
      .findOne({
        userId: new Types.ObjectId(userId),
        isActive: true,
        nextRunDate: { $lte: now },
      })
      .select('_id')
      .lean();

    return !!rule;
  }
}
