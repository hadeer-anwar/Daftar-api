import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionType {
  EXPENSE = 'expense',
  INCOME = 'income',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true })
  amount!: number;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId?: Types.ObjectId;

  @Prop()
  categoryId?: string;

  @Prop({ required: true })
  date!: string;

  @Prop()
  notes?: string;

  @Prop({ required: true, enum: TransactionType })
  transactionType!: TransactionType;

  @Prop()
  incomeType?: 'part-time' | 'freelance' | 'bonus' | 'other';

  @Prop()
  payDate?: string;

  @Prop()
  repeat?: 'monthly' | 'one-time';
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
