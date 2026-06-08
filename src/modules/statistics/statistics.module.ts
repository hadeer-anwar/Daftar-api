import { Module } from '@nestjs/common';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsAggregationService } from './statistics-aggregation.service';
import { MongooseModule } from '@nestjs/mongoose';
import { CategorySchema } from '../categories/schemas/category.schema';
import { TransactionSchema } from '../transactions/schemas/transactions.schema';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Category', schema: CategorySchema }]),
    MongooseModule.forFeature([
      { name: 'Transaction', schema: TransactionSchema },
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService, StatisticsAggregationService],
})
export class StatisticsModule {}
