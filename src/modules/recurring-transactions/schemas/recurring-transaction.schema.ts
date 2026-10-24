import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import {
  IncomeType,
  TransactionType,
} from '../../transactions/schemas/transactions.schema';
import { RecurringFrequency } from '../enums/frequency.enum';

export type RecurringTransactionDocument =
  HydratedDocument<RecurringTransaction>;

@Schema({ timestamps: true, collection: 'recurring_transactions' })
export class RecurringTransaction {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, enum: TransactionType })
  type!: TransactionType;

  @Prop({ enum: IncomeType })
  incomeType!: IncomeType;

  @Prop()
  customIncomeType?: string;

  @Prop()
  categoryId?: string;

  @Prop({ required: true, enum: RecurringFrequency })
  frequency!: RecurringFrequency;

  @Prop({ required: true })
  startDate!: Date;

  @Prop({ required: true })
  nextRunDate!: Date;

  @Prop()
  lastGeneratedAt?: Date;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  notes?: string;

  @Prop({ type: Number, required: true, min: 1, max: 120 })
  repeatMonths?: number;

  @Prop({ type: Number, default: 0, min: 0 })
  generatedCount!: number;
}

export const RecurringTransactionSchema =
  SchemaFactory.createForClass(RecurringTransaction);

RecurringTransactionSchema.index({ userId: 1, nextRunDate: 1, isActive: 1 });
RecurringTransactionSchema.index(
  { userId: 1, isActive: 1, incomeType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: TransactionType.INCOME,
      incomeType: IncomeType.SALARY,
    },
  },
);
