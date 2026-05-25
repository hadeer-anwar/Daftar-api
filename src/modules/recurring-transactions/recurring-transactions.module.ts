import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TransactionsModule } from '../transactions/transactions.module';

import { RecurringTransactionsController } from './recurring-transactions.controller';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { RecurringTransactionsRepository } from './repositories/recurring-transactions.repository';
import {
  RecurringTransaction,
  RecurringTransactionSchema,
} from './schemas/recurring-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: RecurringTransaction.name,
        schema: RecurringTransactionSchema,
      },
    ]),
    forwardRef(() => TransactionsModule),
  ],
  controllers: [RecurringTransactionsController],
  providers: [RecurringTransactionsService, RecurringTransactionsRepository],
  exports: [RecurringTransactionsService, RecurringTransactionsRepository],
})
export class RecurringTransactionsModule {}
