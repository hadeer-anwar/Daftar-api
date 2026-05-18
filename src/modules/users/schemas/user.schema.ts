import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Schema({
  timestamps: true,
})
export class User {
  @Prop({
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50,
  })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email!: string;

  @Prop({
    select: false,
  })
  password?: string;

  @Prop({
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
  })
  provider!: AuthProvider;

  @Prop()
  googleId?: string;

  @Prop()
  avatar?: string;

  @Prop({
    default: 0,
    min: 0,
  })
  monthlyIncome!: number;

  @Prop({
    default: 1,
    min: 1,
    max: 31,
  })
  resetDay!: number;

  @Prop({
    default: 'EGP',
  })
  currency!: string;

  @Prop({
    default: false,
  })
  isEmailVerified!: boolean;

  @Prop({
    default: true,
  })
  isActive!: boolean;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop({
    default: 0,
  })
  resetPasswordAttempts!: number;

  @Prop()
  resetPasswordBlockedUntil?: Date;

  @Prop()
  resetPasswordLastSentAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
