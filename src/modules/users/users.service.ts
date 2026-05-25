import { Injectable, NotFoundException } from '@nestjs/common';

import { UsersRepository } from './repositories/users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteAccount(userId: string) {
    const deletedUser = await this.usersRepository.deleteById(userId);

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Account deleted successfully',
    };
  }
}
