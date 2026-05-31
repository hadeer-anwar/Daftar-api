import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionType {
  EXPENSE = 'expense',
  INCOME = 'income',
}

export enum IncomeType {
  SALARY = 'salary',
  PART_TIME = 'part-time',
  FREELANCE = 'freelance',
  BONUS = 'bonus',
  OTHER = 'other',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId?: Types.ObjectId;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true, enum: TransactionType })
  transactionType!: TransactionType;

  @Prop()
  categoryId?: string;

  @Prop({ required: true })
  date!: Date;

  @Prop({
    type: Types.ObjectId,
    ref: 'RecurringTransaction',
    default: null,
  })
  recurringId?: Types.ObjectId | null;

  @Prop()
  isApplied?: boolean;

  @Prop()
  notes?: string;

  @Prop()
  incomeType?: IncomeType;

  @Prop()
  repeat?: 'monthly' | 'one-time';
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index(
  { recurringId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { recurringId: { $type: 'objectId' } },
  },
);
