import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';

import { RecurringTransactionsService } from './recurring-transactions.service';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';

@ApiTags('Recurring Transactions')
@ApiBearerAuth('accessToken')
@UseGuards(AuthGuard('jwt'))
@Controller('recurring-transactions')
export class RecurringTransactionsController {
  constructor(
    private readonly recurringService: RecurringTransactionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get all active recurring rules for the current user.',
  })
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.recurringService.findByUserId(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recurring rule by id.' })
  async findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.recurringService.findById(user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring rule.' })
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringTransactionDto,
  ) {
    return this.recurringService.update(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a recurring rule.' })
  async delete(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.recurringService.delete(user.userId, id);
  }
}
