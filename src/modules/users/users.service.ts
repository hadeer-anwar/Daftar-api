import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UsersRepository } from './repositories/users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';
import { generateOtp } from '../../common/utils/generate-otp';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: UpdateUserDto) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isEmailVerified) {
      throw new NotFoundException('Email not verified');
    }

    if (data.email !== undefined) {
      const existingUser = await this.usersRepository.findByEmail(data.email);

      if (existingUser) {
        throw new NotFoundException('Email is already in use');
      }
      user.email = data.email;
    }
    if (data.name !== undefined) {
      user.name = data.name;
    }

    await user.save();

    return user;
  }

  async requestEmailVerification(userId: string, email?: string) {
    if (!email) {
      return;
    }

    const otp = generateOtp();

    await this.mailService.sendResetCode(email, otp, 'Email Verification Code');
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    await this.usersRepository.updateById(userId, {
      emailVerificationToken: hashedOtp,
      emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      !user.emailVerificationToken ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Verification code expired');
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    if (hashedCode !== user.emailVerificationToken) {
      throw new BadRequestException('Invalid verification code');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    return {
      message: 'Email verified successfully',
    };
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
