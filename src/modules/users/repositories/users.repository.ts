import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  async findById(userId: string) {
    return this.userModel.findById(userId).select('+password');
  }

  async findByEmail(email: string) {
    return this.userModel
      .findOne({
        email: email.toLowerCase(),
      })
      .select('+password');
  }

  async updateById(userId: string, data: Partial<User>) {
    return this.userModel.findByIdAndUpdate(userId, data, {
      new: true,
      runValidators: true,
    });
  }

  async deleteById(userId: string) {
    return this.userModel.findByIdAndDelete(userId);
  }
}
