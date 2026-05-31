import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Faq {
  @Prop({
    type: Map,
    of: String,
    required: true,
  })
  question!: Map<string, string>;

  @Prop({
    type: Map,
    of: String,
    required: true,
  })
  answer!: Map<string, string>;

  @Prop({
    default: true,
  })
  isActive!: boolean;

  @Prop({
    default: 0,
  })
  order!: number;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);
