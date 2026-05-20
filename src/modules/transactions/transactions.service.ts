import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Types } from 'mongoose';

import { TransactionRepository } from './repositories/transactions.repository';
import { UsersRepository } from '../users/repositories/users.repository';

import { TransactionType, Transaction } from './schemas/transactions.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  async create(userId: string, dto: CreateTransactionDto) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const effectiveDate: Date =
      dto.transactionType === TransactionType.INCOME
        ? new Date(dto.payDate ?? new Date())
        : new Date(dto.date ?? new Date());

    const transaction = await this.transactionRepository.create({
      ...dto,
      userId: new Types.ObjectId(userId),
      date: effectiveDate,
    });

    // Update running balances on the user document
    const incomeBalance =
      dto.transactionType === TransactionType.INCOME
        ? (user.incomeBalance ?? 0) + dto.amount
        : (user.incomeBalance ?? 0);

    const expenseBalance =
      dto.transactionType === TransactionType.EXPENSE
        ? (user.expenseBalance ?? 0) + dto.amount
        : (user.expenseBalance ?? 0);

    await this.usersRepository.updateById(userId, {
      incomeBalance,
      expenseBalance,
    });

    return transaction;
  }

  async findAllByUser(userId: string) {
    return this.transactionRepository.findByUserId(userId);
  }

  async findWithFilters(userId: string, filterDto: FilterTransactionDto) {
    return this.transactionRepository.findWithFilters(userId, filterDto);
  }

  async update(
    userId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ) {
    const transaction =
      await this.transactionRepository.findById(transactionId);

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.userId?.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let incomeBalance = user.incomeBalance ?? 0;
    let expenseBalance = user.expenseBalance ?? 0;

    // Reverse old transaction effect
    if (transaction.transactionType === TransactionType.INCOME) {
      incomeBalance -= transaction.amount;
    } else {
      expenseBalance -= transaction.amount;
    }

    // Merge old data with new partial dto
    const finalType = dto.transactionType ?? transaction.transactionType;

    const finalAmount = dto.amount ?? transaction.amount;

    // Apply updated transaction effect
    if (finalType === TransactionType.INCOME) {
      incomeBalance += finalAmount;
    } else {
      expenseBalance += finalAmount;
    }

    // Update balances
    await this.usersRepository.updateById(userId, {
      incomeBalance,
      expenseBalance,
    });

    // Build clean partial update object
    const updateData: Partial<Transaction> = {};

    if (dto.amount !== undefined) {
      updateData.amount = dto.amount;
    }

    if (dto.transactionType !== undefined) {
      updateData.transactionType = dto.transactionType;
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    if (dto.categoryId !== undefined) {
      updateData.categoryId = dto.categoryId;
    }

    if (dto.incomeType !== undefined) {
      updateData.incomeType = dto.incomeType;
    }

    if (dto.repeat !== undefined) {
      updateData.repeat = dto.repeat;
    }

    if (dto.date) {
      updateData.date = new Date(dto.date);
    }

    if (dto.payDate) {
      updateData.date = new Date(dto.payDate);
    }

    return this.transactionRepository.updateById(transactionId, updateData);
  }

  async delete(userId: string, transactionId: string) {
    const transaction =
      await this.transactionRepository.findById(transactionId);
    if (!transaction) throw new NotFoundException('Transaction not found');

    // Ownership check
    if (transaction.userId?.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const user = await this.usersRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    let incomeBalance = user.incomeBalance ?? 0;
    let expenseBalance = user.expenseBalance ?? 0;

    if (transaction.transactionType === TransactionType.INCOME) {
      incomeBalance -= transaction.amount;
    } else if (transaction.transactionType === TransactionType.EXPENSE) {
      expenseBalance -= transaction.amount;
    }

    await this.usersRepository.updateById(userId, {
      incomeBalance,
      expenseBalance,
    });
    await this.transactionRepository.deleteById(transactionId);

    return { message: 'Transaction deleted successfully' };
  }
}
