import { SchemaFactory, Prop, Schema } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({
  timestamps: true,
})
export class Category {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
  })
  userId!: Types.ObjectId;

  @Prop()
  color?: string;

  @Prop()
  icon?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ userId: 1, name: 1 }, { unique: true });
