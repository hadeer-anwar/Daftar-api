// statistics.service.ts
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

export interface CategoryStats {
  categoryId: string;
  name: string;
  color?: string;
  icon?: string;
  amount: number;
  percentage: number;
}

export interface StatisticsResponse {
  timeFrame: TimeFrame;
  periodLabel: string;
  totalSpent: number;
  totalIncome: number;
  netBalance: number;
  categories: CategoryStats[];
  trend: TrendData[];
}

export interface TrendData {
  label: string;
  spent: number;
  income: number;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Category.name) private categoryModel: Model<Category>,
  ) {}

  async getStatistics(
    userId: string,
    timeFrame: TimeFrame,
    date: Date = new Date(),
  ): Promise<StatisticsResponse> {
    const { startDate, endDate, periodLabel } = this.getDateRange(
      timeFrame,
      date,
    );

    const [transactions, trendData] = await Promise.all([
      this.getTransactionsInRange(userId, startDate, endDate),
      this.getTrendData(userId, timeFrame, startDate, endDate, date),
    ]);

    const totalSpent = transactions
      .filter((t) => t.transactionType === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = transactions
      .filter((t) => t.transactionType === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const categories = await this.getCategoryBreakdown(
      userId,
      transactions,
      totalSpent,
    );

    return {
      timeFrame,
      periodLabel,
      totalSpent,
      totalIncome,
      netBalance: totalIncome - totalSpent,
      categories,
      trend: trendData,
    };
  }

  private getDateRange(
    timeFrame: TimeFrame,
    date: Date,
  ): { startDate: Date; endDate: Date; periodLabel: string } {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    switch (timeFrame) {
      case TimeFrame.WEEK: {
        const startOfWeek = new Date(date);
        const dayOfWeek = date.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startOfWeek.setDate(day - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
        const periodLabel = `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;

        return { startDate: startOfWeek, endDate: endOfWeek, periodLabel };
      }

      case TimeFrame.MONTH: {
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);
        const periodLabel = startOfMonth.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });
        return { startDate: startOfMonth, endDate: endOfMonth, periodLabel };
      }

      case TimeFrame.YEAR: {
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);
        const periodLabel = year.toString();
        return { startDate: startOfYear, endDate: endOfYear, periodLabel };
      }
    }
  }

  private async getTransactionsInRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]> {
    return this.transactionModel
      .find({
        userId: new Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
      })
      .lean()
      .exec();
  }

  private async getCategoryBreakdown(
    userId: string,
    transactions: Transaction[],
    totalSpent: number,
  ): Promise<CategoryStats[]> {
    if (totalSpent === 0) return [];

    // Get all user categories for mapping
    const categories = await this.categoryModel
      .find({ userId: new Types.ObjectId(userId) })
      .lean()
      .exec();

    const categoryMap = new Map(
      categories.map((c) => [
        c._id.toString(),
        { name: c.name, color: c.color, icon: c.icon },
      ]),
    );

    // Aggregate spent by category
    const expenseTransactions = transactions.filter(
      (t) => t.transactionType === TransactionType.EXPENSE,
    );

    const categoryAmounts = new Map<string, number>();

    for (const transaction of expenseTransactions) {
      if (transaction.categoryId) {
        const current = categoryAmounts.get(transaction.categoryId) || 0;
        categoryAmounts.set(
          transaction.categoryId,
          current + transaction.amount,
        );
      }
    }

    // Build result with percentages
    const results: CategoryStats[] = [];

    for (const [categoryId, amount] of categoryAmounts) {
      const categoryInfo = categoryMap.get(categoryId);
      results.push({
        categoryId,
        name: categoryInfo?.name || 'Uncategorized',
        color: categoryInfo?.color,
        icon: categoryInfo?.icon,
        amount,
        percentage: parseFloat(((amount / totalSpent) * 100).toFixed(1)),
      });
    }

    // Sort by amount descending
    return results.sort((a, b) => b.amount - a.amount);
  }

  private async getTrendData(
    userId: string,
    timeFrame: TimeFrame,
    startDate: Date,
    endDate: Date,
    currentDate: Date,
  ): Promise<TrendData[]> {
    switch (timeFrame) {
      case TimeFrame.WEEK:
        return this.getWeeklyTrend(userId, startDate);
      case TimeFrame.MONTH:
        return this.getMonthlyTrend(userId, startDate);
      case TimeFrame.YEAR:
        return this.getYearlyTrend(userId, currentDate.getFullYear());
      default:
        return [];
    }
  }

  private async getWeeklyTrend(
    userId: string,
    weekStart: Date,
  ): Promise<TrendData[]> {
    const trends: TrendData[] = [];

    for (let i = 0; i < 4; i++) {
      const weekStartDate = new Date(weekStart);
      weekStartDate.setDate(weekStart.getDate() - i * 7);

      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);
      weekEndDate.setHours(23, 59, 59, 999);

      const transactions = await this.getTransactionsInRange(
        userId,
        weekStartDate,
        weekEndDate,
      );

      const spent = transactions
        .filter((t) => t.transactionType === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);

      const income = transactions
        .filter((t) => t.transactionType === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);

      trends.unshift({
        label: `Week #${4 - i}`,
        spent,
        income,
      });
    }

    return trends;
  }

  private async getMonthlyTrend(
    userId: string,
    monthStart: Date,
  ): Promise<TrendData[]> {
    const trends: TrendData[] = [];
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();

    // Get last 4 weeks of the month (or approximate weekly breakdown)
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(year, month, 1 + week * 7);
      const weekEnd = new Date(
        year,
        month,
        Math.min(
          1 + (week + 1) * 7 - 1,
          new Date(year, month + 1, 0).getDate(),
        ),
        23,
        59,
        59,
        999,
      );

      if (weekStart > new Date(year, month + 1, 0)) break;

      const transactions = await this.getTransactionsInRange(
        userId,
        weekStart,
        weekEnd,
      );

      const spent = transactions
        .filter((t) => t.transactionType === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);

      const income = transactions
        .filter((t) => t.transactionType === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);

      trends.push({
        label: `Week ${week + 1}`,
        spent,
        income,
      });
    }

    return trends;
  }

  private async getYearlyTrend(
    userId: string,
    year: number,
  ): Promise<TrendData[]> {
    const trends: TrendData[] = [];

    // Get last 12 months including current
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(year, new Date().getMonth() - i, 1);
      const yearForMonth = targetDate.getFullYear();
      const month = targetDate.getMonth();

      const startOfMonth = new Date(yearForMonth, month, 1);
      const endOfMonth = new Date(yearForMonth, month + 1, 0, 23, 59, 59, 999);

      const transactions = await this.getTransactionsInRange(
        userId,
        startOfMonth,
        endOfMonth,
      );

      const spent = transactions
        .filter((t) => t.transactionType === TransactionType.EXPENSE)
        .reduce((sum, t) => sum + t.amount, 0);

      const income = transactions
        .filter((t) => t.transactionType === TransactionType.INCOME)
        .reduce((sum, t) => sum + t.amount, 0);

      trends.push({
        label: startOfMonth.toLocaleString('default', { month: 'short' }),
        spent,
        income,
      });
    }

    return trends;
  }
}
