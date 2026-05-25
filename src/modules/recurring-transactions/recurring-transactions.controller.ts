import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';

import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { RecurringTransactionsService } from './recurring-transactions.service';

@ApiTags('Recurring Transactions')
@ApiBearerAuth('accessToken')
@UseGuards(AuthGuard('jwt'))
@Controller('recurring-transactions')
export class RecurringTransactionsController {
  constructor(
    private readonly recurringService: RecurringTransactionsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a recurring rule (and the first transaction immediately).',
  })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateRecurringTransactionDto,
  ) {
    return this.recurringService.create(user.userId, dto);
  }

  @Post('generate')
  @ApiOperation({
    summary:
      'Manually trigger generation of any due transactions for the current user.',
  })
  async generate(@CurrentUser() user: CurrentUserData) {
    const generated = await this.recurringService.generateDueTransactions(
      user.userId,
    );
    return { generatedCount: generated.length, transactions: generated };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recurring rule by id.' })
  async findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.recurringService.findById(user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a recurring rule (soft stop).' })
  async deactivate(@Param('id') id: string) {
    return this.recurringService.deactivate(id);
  }
}
