// statistics-aggregation.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionType,
} from '../transactions/schemas/transactions.schema';
import { Category } from '../categories/schemas/category.schema';

export enum TimeFrame {
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
  icon?: string;
  amount: number;
  percentage: number;
}

@Injectable()
export class StatisticsAggregationService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}

  async getStatisticsAggregated(
    userId: string,
    timeFrame: TimeFrame,
    date: Date = new Date(),
  ) {
    const { startDate, endDate, periodLabel } = this.getDateRange(
      timeFrame,
      date,
    );

    const [overview, categoryBreakdown, trendData] = await Promise.all([
      this.getOverviewStats(userId, startDate, endDate),
      this.getCategoryBreakdownAggregated(userId, startDate, endDate),
      this.getTrendDataAggregated(userId, timeFrame, date),
    ]);

    return {
      timeFrame,
      periodLabel,
      ...overview,
      categories: categoryBreakdown,
      trend: trendData,
    };
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
      icon: cat.icon,
      amount: cat.amount,
      percentage: parseFloat(cat.percentage.toFixed(1)),
    }));
  }

  private async getTrendDataAggregated(
    userId: string,
    timeFrame: TimeFrame,
    currentDate: Date,
  ) {
    switch (timeFrame) {
      case TimeFrame.WEEK:
        return this.getWeeklyTrendAggregated(userId, currentDate);
      case TimeFrame.MONTH:
        return this.getMonthlyTrendAggregated(userId, currentDate);
      case TimeFrame.YEAR:
        return this.getYearlyTrendAggregated(userId, currentDate.getFullYear());
      default:
        return [];
    }
  }

  private async getWeeklyTrendAggregated(userId: string, currentDate: Date) {
    // Build the last 4 week-start dates (oldest first) anchored on the
    // selected week, so each result bucket maps to a fixed slot even when a
    // week has no transactions.
    const currentWeekStart = this.getWeekStart(currentDate);
    const weekStarts: Date[] = [];
    for (let i = 3; i >= 0; i--) {
      const ws = new Date(currentWeekStart);
      ws.setDate(currentWeekStart.getDate() - i * 7);
      weekStarts.push(ws);
    }

    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: {
            $gte: weekStarts[0],
            $lte: this.getWeekEnd(currentDate),
          },
        },
      },
      {
        $group: {
          _id: {
            week: {
              $dateTrunc: {
                date: '$date',
                unit: 'week',
                startOfWeek: 'monday',
              },
            },
            type: '$transactionType',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.week',
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

    // Align each week bucket to its slot. Match by date range rather than exact
    // equality so timezone differences between $dateTrunc (UTC) and the locally
    // computed week starts don't drop buckets.
    return weekStarts.map((ws, i) => {
      const weekEnd = new Date(ws);
      weekEnd.setDate(ws.getDate() + 7);
      const bucket = result.find((r) => {
        const bucketDate = new Date(r._id);
        return bucketDate >= ws && bucketDate < weekEnd;
      });

      return {
        label: `Week #${i + 1}`,
        spent: bucket?.spent || 0,
        income: bucket?.income || 0,
      };
    });
  }

  private async getYearlyTrendAggregated(userId: string, year: number) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startOfYear, $lte: endOfYear },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            type: '$transactionType',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.month',
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
      { $sort: { _id: 1 } },
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

    // Create array of all months (including zeros for missing data)
    const trends: Array<{ label: string; spent: number; income: number }> = [];
    for (let month = 1; month <= 12; month++) {
      const monthData = result.find((r) => r._id === month);
      trends.push({
        label: monthNames[month - 1],
        spent: monthData?.spent || 0,
        income: monthData?.income || 0,
      });
    }

    return trends;
  }

  private async getMonthlyTrendAggregated(userId: string, currentDate: Date) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: {
            week: {
              $ceil: { $divide: [{ $dayOfMonth: '$date' }, 7] },
            },
            type: '$transactionType',
          },
          total: { $sum: '$amount' },
        },
      },
      {
        $group: {
          _id: '$_id.week',
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
      { $sort: { _id: 1 } },
    ]);

    const trends: Array<{ label: string; spent: number; income: number }> = [];
    for (let week = 1; week <= 4; week++) {
      const weekData = result.find((r) => r._id === week);
      trends.push({
        label: `Week ${week}`,
        spent: weekData?.spent || 0,
        income: weekData?.income || 0,
      });
    }

    return trends;
  }

  private getWeekStart(date: Date, weeksAgo: number = 0): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    result.setDate(result.getDate() - diffToMonday - weeksAgo * 7);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private getWeekEnd(date: Date): Date {
    const result = this.getWeekStart(date);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  private getDateRange(timeFrame: 'week' | 'month' | 'year', date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    switch (timeFrame) {
      case 'week': {
        const start = this.getWeekStart(date);
        const end = this.getWeekEnd(date);
        const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
        return {
          startDate: start,
          endDate: end,
          periodLabel: `${formatDate(start)} - ${formatDate(end)}`,
        };
      }
      case 'month': {
        return {
          startDate: new Date(year, month, 1),
          endDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
          periodLabel: new Date(year, month, 1).toLocaleString('default', {
            month: 'long',
            year: 'numeric',
          }),
        };
      }
      case 'year': {
        return {
          startDate: new Date(year, 0, 1),
          endDate: new Date(year, 11, 31, 23, 59, 59, 999),
          periodLabel: year.toString(),
        };
      }
    }
  }
}
