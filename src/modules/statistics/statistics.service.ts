// statistics-aggregation.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionType,
} from '../transactions/schemas/transactions.schema';
import { StatisticsParamsDto } from './dto/statistics-params.dto';

export enum TimeFrame {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

const UNCATEGORIZED_ID = 'uncategorized';
const UNCATEGORIZED_NAME = 'Uncategorized';

interface CategoryBreakdown {
  categoryId: string;
  name: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  icon?: string;
  amount: number;
  percentage: number;
}

interface DayTransactionAggregate {
  _id: Types.ObjectId;
  amount: number;
  transactionType: TransactionType;
  date: Date;
  notes?: string;
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  categoryBackgroundColor?: string;
  categoryBorderColor?: string;
  categoryIcon?: string;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
  ) {}

  async getStatisticsAggregated(userId: string, params: StatisticsParamsDto) {
    if (params.timeFrame === TimeFrame.DAY) {
      return this.getDayStatisticsAggregated(userId, params);
    }
    const { startDate, endDate, periodLabel } = this.buildDateRange(params);

    const [overview, categories, trend] = await Promise.all([
      this.getOverviewStats(userId, startDate, endDate),
      this.getCategoryBreakdownAggregated(userId, startDate, endDate),
      this.getTrendDataAggregated(userId, params, startDate, endDate),
    ]);

    return {
      timeFrame: params.timeFrame,
      periodLabel,
      ...overview,
      categories,
      trend,
    };
  }

  private async getDayStatisticsAggregated(
    userId: string,
    params: StatisticsParamsDto,
  ) {
    const {
      startDate: startOfDay,
      endDate: endOfDay,
      periodLabel,
    } = this.buildDateRange(params);

    const [openingBalance, dayTransactions] = await Promise.all([
      this.getOpeningBalanceAggregated(userId, startOfDay),
      this.getDayTransactionsWithCategory(userId, startOfDay, endOfDay),
    ]);

    let totalSpent = 0;
    let totalIncome = 0;
    for (const txn of dayTransactions) {
      if (txn.transactionType === TransactionType.EXPENSE) {
        totalSpent += txn.amount;
      } else {
        totalIncome += txn.amount;
      }
    }

    const netBalance = totalIncome - totalSpent;
    const closingBalance = openingBalance + netBalance;

    // dayTransactions is already sorted date ASC, createdAt ASC, _id ASC by
    // the aggregation pipeline, so a single forward pass gives us a correct
    // running balance for balanceBefore/balanceAfter on every transaction.
    let runningBalance = openingBalance;
    const transactions = dayTransactions.map((txn) => {
      const balanceBefore = runningBalance;
      const signedAmount =
        txn.transactionType === TransactionType.INCOME
          ? txn.amount
          : -txn.amount;
      runningBalance += signedAmount;
      const balanceAfter = runningBalance;

      return {
        _id: txn._id,
        amount: txn.amount,
        transactionType: txn.transactionType,
        date: txn.date,
        notes: txn.notes,
        categoryId: txn.categoryId,
        categoryName: txn.categoryName,
        categoryColor: txn.categoryColor,
        categoryBackgroundColor: txn.categoryBackgroundColor,
        categoryBorderColor: txn.categoryBorderColor,
        categoryIcon: txn.categoryIcon,
        // "percentage of daily expenses" only has meaning for expense
        // transactions; income entries carry 0 rather than an unrelated %.
        percentage:
          txn.transactionType === TransactionType.EXPENSE && totalSpent > 0
            ? parseFloat(((txn.amount / totalSpent) * 100).toFixed(1))
            : 0,
        balanceBefore,
        balanceAfter,
      };
    });

    return {
      timeFrame: params.timeFrame,
      periodLabel,
      totalSpent,
      totalIncome,
      netBalance,
      openingBalance,
      closingBalance,
      transactions,
    };
  }

  /**
   * Opening balance = total income - total expenses for every transaction
   * strictly before `beforeDate`. Computed entirely in MongoDB so we never
   * pull a user's full transaction history into Node.
   */
  private async getOpeningBalanceAggregated(
    userId: string,
    beforeDate: Date,
  ): Promise<number> {
    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $lt: beforeDate },
        },
      },
      {
        $group: {
          _id: '$transactionType',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let income = 0;
    let expense = 0;
    for (const item of result) {
      if (item._id === TransactionType.INCOME) {
        income = item.total;
      } else if (item._id === TransactionType.EXPENSE) {
        expense = item.total;
      }
    }

    return income - expense;
  }

  /**
   * Fetches only the selected day's transactions with category info attached
   * (same categoryId -> ObjectId conversion + lookup pattern used in
   * getCategoryBreakdownAggregated), sorted date ASC, createdAt ASC, _id ASC.
   */
  private async getDayTransactionsWithCategory(
    userId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<DayTransactionAggregate[]> {
    return this.transactionModel.aggregate<DayTransactionAggregate>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $addFields: {
          categoryObjectId: {
            $convert: {
              input: '$categoryId',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryObjectId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $unwind: {
          path: '$categoryInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          amount: 1,
          transactionType: 1,
          date: 1,
          notes: 1,
          createdAt: 1,
          categoryId: { $ifNull: ['$categoryId', UNCATEGORIZED_ID] },
          categoryName: { $ifNull: ['$categoryInfo.name', UNCATEGORIZED_NAME] },
          categoryColor: '$categoryInfo.color',
          categoryBackgroundColor: '$categoryInfo.backgroundColor',
          categoryBorderColor: '$categoryInfo.borderColor',
          categoryIcon: '$categoryInfo.icon',
        },
      },
      {
        $sort: { date: 1, createdAt: 1, _id: 1 },
      },
    ]);
  }

  private async getOverviewStats(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$transactionType',
          total: { $sum: '$amount' },
        },
      },
    ]);

    let totalSpent = 0;
    let totalIncome = 0;

    for (const item of result) {
      if (item._id === TransactionType.EXPENSE) {
        totalSpent = item.total;
      } else if (item._id === TransactionType.INCOME) {
        totalIncome = item.total;
      }
    }

    return {
      totalSpent,
      totalIncome,
      netBalance: totalIncome - totalSpent,
    };
  }

  private async getCategoryBreakdownAggregated(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CategoryBreakdown[]> {
    // Get total spent for percentage calculation
    const totalSpentResult = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
          transactionType: TransactionType.EXPENSE,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totalSpent = totalSpentResult[0]?.total || 0;
    if (totalSpent === 0) return [];

    // Get category breakdown. Transactions store `categoryId` as a string while
    // the categories collection keys on an ObjectId `_id`, so we convert before
    // the lookup. Missing/invalid category ids fall into an "Uncategorized" bucket.
    const categoryAggregation = await this.transactionModel.aggregate<
      CategoryBreakdown & { _id: string | null }
    >([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
          transactionType: TransactionType.EXPENSE,
        },
      },
      {
        $group: {
          _id: '$categoryId',
          amount: { $sum: '$amount' },
        },
      },
      {
        $addFields: {
          categoryObjectId: {
            $convert: {
              input: '$_id',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryObjectId',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      {
        $unwind: {
          path: '$categoryInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          categoryId: { $ifNull: ['$_id', UNCATEGORIZED_ID] },
          name: { $ifNull: ['$categoryInfo.name', UNCATEGORIZED_NAME] },
          color: '$categoryInfo.color',
          backgroundColor: '$categoryInfo.backgroundColor',
          borderColor: '$categoryInfo.borderColor',
          icon: '$categoryInfo.icon',
          amount: 1,
          percentage: {
            $multiply: [{ $divide: ['$amount', totalSpent] }, 100],
          },
        },
      },
      {
        $sort: { amount: -1 },
      },
    ]);

    return categoryAggregation.map((cat) => ({
      categoryId: cat.categoryId,
      name: cat.name,
      color: cat.color,
      backgroundColor: cat.backgroundColor,
      borderColor: cat.borderColor,
      icon: cat.icon,
      amount: cat.amount,
      percentage: parseFloat(cat.percentage.toFixed(1)),
    }));
  }

  private async getTrendDataAggregated(
    userId: string,
    params: StatisticsParamsDto,
    startDate: Date,
    endDate: Date,
  ) {
    const timeFrame = params.timeFrame;

    switch (timeFrame) {
      case TimeFrame.WEEK:
        // startDate/endDate here are the exact selected-week boundaries
        // already resolved by buildDateRange (one calendar week, 7 days).
        return this.getWeeklyTrendAggregated(userId, startDate, endDate);

      case TimeFrame.MONTH:
        return this.getMonthlyComparisonTrend(userId, params.year!);

      case TimeFrame.YEAR:
        return this.getYearlyTrendAggregated(userId, params.year!);

      default:
        return [];
    }
  }

  /**
   * Builds a 7-point trend, one entry per day of the selected week
   * (startDate -> endDate inclusive). Every day is always represented,
   * even if it has zero transactions.
   */
  private async getWeeklyTrendAggregated(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    // Normalize to the start of the first day and end of the last day
    // so the $match range fully covers all 7 days regardless of the
    // time component passed in.
    const rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);

    // Build the 7 calendar days for the selected week, in order,
    // starting from rangeStart.
    const days: { key: string; label: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      days.push({
        key: this.toDateKey(d),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d,
      });
    }

    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: rangeStart, $lte: rangeEnd },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            type: '$transactionType',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.day',
          spent: {
            $sum: {
              $cond: [
                { $eq: ['$_id.type', TransactionType.EXPENSE] },
                '$total',
                0,
              ],
            },
          },
          income: {
            $sum: {
              $cond: [
                { $eq: ['$_id.type', TransactionType.INCOME] },
                '$total',
                0,
              ],
            },
          },
        },
      },
    ]);

    const byDay = new Map<string, { spent: number; income: number }>();
    for (const r of result) {
      byDay.set(r._id, { spent: r.spent ?? 0, income: r.income ?? 0 });
    }

    const todayKey = this.toDateKey(new Date());

    const data = days.map((d) => ({
      label: d.label,
      date: d.key,
      spent: byDay.get(d.key)?.spent ?? 0,
      income: byDay.get(d.key)?.income ?? 0,
    }));

    // Highlight "today" if it falls within the selected week, otherwise
    // fall back to the last day of the range.
    const todayIndex = days.findIndex((d) => d.key === todayKey);
    const selectedIndex = todayIndex !== -1 ? todayIndex : days.length - 1;

    return {
      selectedIndex,
      data,
    };
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async getYearlyTrendAggregated(userId: string, selectedYear: number) {
    const currentYear = new Date().getFullYear();

    const startYear = Math.max(selectedYear - 2, currentYear - 4);

    const endYear = currentYear;

    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: {
            $gte: new Date(startYear, 0, 1),
            $lte: new Date(endYear, 11, 31, 23, 59, 59, 999),
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            type: '$transactionType',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.year',
          spent: {
            $sum: {
              $cond: [
                {
                  $eq: ['$_id.type', TransactionType.EXPENSE],
                },
                '$total',
                0,
              ],
            },
          },
          income: {
            $sum: {
              $cond: [
                {
                  $eq: ['$_id.type', TransactionType.INCOME],
                },
                '$total',
                0,
              ],
            },
          },
        },
      },
    ]);

    const years: { label: string; spent: number; income: number }[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const data = result.find((r) => r._id === year);

      years.push({
        label: year.toString(),
        spent: data?.spent ?? 0,
        income: data?.income ?? 0,
      });
    }

    return {
      selectedIndex: years.findIndex(
        (y) => y.label === selectedYear.toString(),
      ),
      data: years,
    };
  }

  private async getMonthlyComparisonTrend(userId: string, year: number) {
    const startOfYear = new Date(year, 0, 1);

    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: {
            $gte: startOfYear,
            $lte: endOfYear,
          },
        },
      },
      {
        $group: {
          _id: {
            month: {
              $month: '$date',
            },
            type: '$transactionType',
          },
          total: {
            $sum: '$amount',
          },
        },
      },
      {
        $group: {
          _id: '$_id.month',
          spent: {
            $sum: {
              $cond: [
                {
                  $eq: ['$_id.type', TransactionType.EXPENSE],
                },
                '$total',
                0,
              ],
            },
          },
          income: {
            $sum: {
              $cond: [
                {
                  $eq: ['$_id.type', TransactionType.INCOME],
                },
                '$total',
                0,
              ],
            },
          },
        },
      },
    ]);

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return monthNames.map((label, index) => {
      const month = index + 1;

      const data = result.find((r) => r._id === month);

      return {
        label,
        spent: data?.spent ?? 0,
        income: data?.income ?? 0,
      };
    });
  }

  private buildDateRange(params: StatisticsParamsDto) {
    switch (params.timeFrame) {
      case TimeFrame.DAY: {
        // Parsed from local date components (same convention as MONTH/YEAR
        // below) rather than `new Date(params.date)` directly, to avoid the
        // UTC-midnight parsing shift that a bare ISO-date string can cause.
        const [year, month, day] = params.date!.split('-').map(Number);

        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

        return {
          startDate,
          endDate,
          periodLabel: startDate.toLocaleDateString('default', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        };
      }
      case TimeFrame.WEEK: {
        const startDate = new Date(params.startDate!);

        const endDate = new Date(params.endDate!);

        return {
          startDate,
          endDate,
          periodLabel: `${params.startDate} - ${params.endDate}`,
        };
      }

      case TimeFrame.MONTH: {
        const startDate = new Date(params.year!, params.month! - 1, 1);

        const endDate = new Date(
          params.year!,
          params.month!,
          0,
          23,
          59,
          59,
          999,
        );

        return {
          startDate,
          endDate,
          periodLabel: startDate.toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          }),
        };
      }

      case TimeFrame.YEAR:
        return {
          startDate: new Date(params.year!, 0, 1),
          endDate: new Date(params.year!, 11, 31, 23, 59, 59, 999),
          periodLabel: params.year!.toString(),
        };
    }
  }
}
