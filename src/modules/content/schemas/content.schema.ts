import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ContentDocument = HydratedDocument<Content>;

export enum ContentType {
  TERMS = 'terms',
  PRIVACY = 'privacy',
}

@Schema({ timestamps: true })
export class Content {
  @Prop({
    required: true,
    enum: ContentType,
    unique: true,
  })
  key!: ContentType;

  @Prop({
    type: Map,
    of: String,
    required: true,
  })
  title!: Map<string, string>;

  @Prop({
    type: Map,
    of: String,
    required: true,
  })
  content!: Map<string, string>;
}

export const ContentSchema = SchemaFactory.createForClass(Content);
