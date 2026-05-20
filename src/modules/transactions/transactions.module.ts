import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TransactionController } from './transactions.controller';
import { TransactionService } from './transactions.service';
import { TransactionRepository } from './repositories/transactions.repository';
import { Transaction, TransactionSchema } from './schemas/transactions.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    UsersModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService, TransactionRepository],
})
export class TransactionsModule {}
