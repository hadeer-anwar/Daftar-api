import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  IncomeType,
  Transaction,
  TransactionType,
} from '../schemas/transactions.schema';
import { Model, Types } from 'mongoose';
import { DateRangePreset } from '../dto/filter-transaction.dto';

export interface TransactionFilterOptions {
  transactionType?: TransactionType;
  incomeType?: IncomeType;
  preset?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
}

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async create(data: Partial<Transaction>) {
    return this.transactionModel.create(data);
  }

  async findById(transactionId: string) {
    return this.transactionModel.findById(transactionId);
  }

  async findByIdAndUser(transactionId: string, userId: string) {
    return this.transactionModel.findOne({
      _id: transactionId,
      userId: new Types.ObjectId(userId),
    });
  }

  async findByUserId(userId: string) {
    return this.transactionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .limit(10);
  }

  async findAllByUser(userId: string) {
    return this.findByUserId(userId);
  }

  async existsRecurringTransaction(
    recurringId: string | Types.ObjectId,
    date: Date,
  ): Promise<boolean> {
    const exists = await this.transactionModel.exists({
      recurringId:
        typeof recurringId === 'string'
          ? new Types.ObjectId(recurringId)
          : recurringId,
      date,
    });
    return Boolean(exists);
  }

  async findWithFilters(userId: string, options: TransactionFilterOptions) {
    const {
      transactionType,
      incomeType,
      preset,
      startDate,
      endDate,
      categoryId,
    } = options;

    const { start, end } = this.resolveDateRange(preset, startDate, endDate);

    const query: Record<string, any> = {
      userId: new Types.ObjectId(userId),
      date: { $gte: start, $lte: end },
    };

    if (transactionType) {
      query.transactionType = transactionType;
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (transactionType === TransactionType.INCOME && incomeType) {
      query.incomeType = incomeType;
    }

    return this.transactionModel.find(query).sort({ date: -1 });
  }

  async updateById(transactionId: string, data: Partial<Transaction>) {
    return this.transactionModel.findByIdAndUpdate(
      transactionId,
      { $set: data },
      { new: true, runValidators: true },
    );
  }

  async deleteById(transactionId: string) {
    return this.transactionModel.findByIdAndDelete(transactionId);
  }

  private resolveDateRange(
    preset?: DateRangePreset,
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const now = new Date();

    if (preset) {
      switch (preset) {
        case DateRangePreset.THIS_WEEK: {
          // Sunday = day 0; start of current week
          const start = new Date(now);
          start.setDate(now.getDate() - now.getDay());
          start.setHours(0, 0, 0, 0);
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        case DateRangePreset.THIS_MONTH: {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          );
          return { start, end };
        }
        case DateRangePreset.LAST_MONTH: {
          const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const end = new Date(
            now.getFullYear(),
            now.getMonth(),
            0,
            23,
            59,
            59,
            999,
          );
          return { start, end };
        }
        case DateRangePreset.THIS_YEAR: {
          const start = new Date(now.getFullYear(), 0, 1);
          const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          return { start, end };
        }
      }
    }

    return {
      start: startDate ? new Date(startDate) : new Date(0),
      end: endDate ? new Date(endDate) : new Date(),
    };
  }

  async deleteManyByUserId(userId: string) {
    return this.transactionModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
  }
}
