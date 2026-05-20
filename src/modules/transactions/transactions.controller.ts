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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { TransactionService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';

@ApiTags('Transactions')
@ApiBearerAuth('accessToken')
@UseGuards(AuthGuard('jwt'))
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new income or expense transaction' })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions for the current user' })
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.transactionService.findAllByUser(user.userId);
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
    return this.transactionService.findWithFilters(user.userId, filterDto);
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
