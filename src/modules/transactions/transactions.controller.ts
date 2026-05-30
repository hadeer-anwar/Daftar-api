import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiExtraModels,
  ApiBody,
  getSchemaPath,
} from '@nestjs/swagger';

import { TransactionService } from './transactions.service';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  DateRangePreset,
  FilterTransactionDto,
} from './dto/filter-transaction.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';
import { CreateIncomeTransactionDto } from './dto/create-income.dto';
import { CreateExpenseTransactionDto } from './dto/create-expense.dto';
import { TransactionType, IncomeType } from './schemas/transactions.schema';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth('accessToken')
@UseGuards(AuthGuard('jwt'))
@Controller('transactions')
export class TransactionController {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly recurringService: RecurringTransactionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new income or expense transaction' })
  @ApiExtraModels(CreateExpenseTransactionDto, CreateIncomeTransactionDto)
  @ApiBody({
    schema: {
      oneOf: [
        {
          $ref: getSchemaPath(CreateExpenseTransactionDto),
        },
        {
          $ref: getSchemaPath(CreateIncomeTransactionDto),
        },
      ],
      discriminator: {
        propertyName: 'transactionType',
      },
    },
    examples: {
      expense: {
        summary: 'Expense Transaction',
        value: {
          amount: 500,
          transactionType: 'expense',
          categoryId: '64abc123',
          date: '2026-05-24',
          notes: 'Pizza dinner',
        },
      },
      income: {
        summary: 'Income Transaction',
        value: {
          amount: 10000,
          transactionType: 'income',
          incomeType: 'salary',
          payDate: '2026-06-01',
          repeat: 'monthly',
          notes: 'Monthly salary',
        },
      },
    },
  })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateExpenseTransactionDto | CreateIncomeTransactionDto,
  ) {
    return this.transactionService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions for the current user' })
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.transactionService.findAllByUser(user.userId);
  }

  @Get('salary')
  @ApiOperation({
    summary: 'Get all salary income transactions for the current user',
  })
  async getUserSalary(@CurrentUser() user: CurrentUserData) {
    const filterDto: FilterTransactionDto = {
      transactionType: TransactionType.INCOME,
      incomeType: IncomeType.SALARY,
      preset: DateRangePreset.THIS_MONTH,
    };
    console.log('Filtering salary transactions with:', filterDto);
    return this.transactionService.findWithFilters(user.userId, filterDto);
  }

  @Get('filter')
  @ApiOperation({
    summary:
      'Filter transactions by type, date range (preset or custom), and category',
    description: `
      Supports:
      - **transactionType**: \`expense\` or \`income\`
      - **preset**: \`this_week\` | \`this_month\` | \`last_month\` | \`this_year\`
      - **startDate / endDate**: custom ISO date range (used when preset is not set)
      - **categoryId**: filter expense transactions by category
    `,
  })
  async findWithFilters(
    @CurrentUser() user: CurrentUserData,
    @Query() filterDto: FilterTransactionDto,
  ) {
    console.log('Filtering transactions with:', filterDto);
    return this.transactionService.findWithFilters(user.userId, filterDto);
  }

  @Get('balances/summary')
  @ApiOperation({ summary: 'Get a summary of transaction balances' })
  async getBalanceSummary(@CurrentUser() user: CurrentUserData) {
    await this.recurringService.generateDueTransactions(user.userId);
    return this.transactionService.getBalanceSummary(user.userId);
  }

  @Patch(':transactionId')
  @ApiOperation({ summary: 'Update a transaction (partial update supported)' })
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionService.update(user.userId, transactionId, dto);
  }

  @Delete(':transactionId')
  @ApiOperation({
    summary: 'Delete a transaction and reverse its balance effect',
  })
  async delete(
    @CurrentUser() user: CurrentUserData,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionService.delete(user.userId, transactionId);
  }
}
