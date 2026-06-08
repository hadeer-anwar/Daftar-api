// statistics-aggregation.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionType,
} from '../transactions/schemas/transactions.schema';
import { Category } from '../categories/schemas/category.schema';
import { StatisticsParamsDto } from './dto/statistics-params.dto';

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
export class StatisticsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}

  async getStatisticsAggregated(userId: string, params: StatisticsParamsDto) {
    const { startDate, endDate, periodLabel } = this.buildDateRange(params);

    const [overview, categories, trend] = await Promise.all([
      this.getOverviewStats(userId, startDate, endDate),
      this.getCategoryBreakdownAggregated(userId, startDate, endDate),
      this.getTrendDataAggregated(userId, params),
    ]);

    return {
      timeFrame: params.timeFrame,
      periodLabel,
      ...overview,
      categories,
      trend,
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
    params: StatisticsParamsDto,
  ) {
    const timeFrame = params.timeFrame;

    switch (timeFrame) {
      case TimeFrame.WEEK:
        return this.getWeeklyTrendAggregated(
          userId,
          new Date(params.startDate!),
        );

      case TimeFrame.MONTH:
        return this.getMonthlyComparisonTrend(userId, params.year!);

      case TimeFrame.YEAR:
        return this.getYearlyTrendAggregated(userId, params.year!);

      default:
        return [];
    }
  }

  private async getWeeklyTrendAggregated(userId: string, selectedDate: Date) {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const startOfMonth = new Date(year, month, 1);

    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const result = await this.transactionModel.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          date: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        },
      },
      {
        $group: {
          _id: {
            week: {
              $ceil: {
                $divide: [{ $dayOfMonth: '$date' }, 7],
              },
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
          _id: '$_id.week',
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
      {
        $sort: {
          _id: 1,
        },
      },
    ]);

    const weeksInMonth = Math.ceil(new Date(year, month + 1, 0).getDate() / 7);

    const selectedWeek = Math.ceil(selectedDate.getDate() / 7);

    return {
      selectedIndex: selectedWeek - 1,
      data: Array.from({ length: weeksInMonth }, (_, index) => {
        const weekNumber = index + 1;

        const weekData = result.find((r) => r._id === weekNumber);

        return {
          label: `Week #${weekNumber}`,
          spent: weekData?.spent ?? 0,
          income: weekData?.income ?? 0,
        };
      }),
    };
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
