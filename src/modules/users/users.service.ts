import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './repositories/users.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';
import { generateOtp } from '../../common/utils/generate-otp';
import * as crypto from 'crypto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfileImage(userId: string, file: Express.Multer.File) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    // delete old image
    if (user.profileImagePublicId) {
      await this.cloudinaryService.deleteImage(user.profileImagePublicId);
    }
    const uploaded = await this.cloudinaryService.uploadImage(file);
    await this.usersRepository.updateById(userId, {
      profileImage: uploaded.secure_url,
      profileImagePublicId: uploaded.public_id,
    });

    return {
      imageUrl: uploaded.secure_url,
    };
  }

  async updateProfile(userId: string, data: UpdateUserDto) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (data.name !== undefined) {
      user.name = data.name;
    }

    if (data.email && data.email !== user.email) {
      if (user.pendingEmail !== data.email || !user.pendingEmailVerified) {
        throw new BadRequestException('You should verify email first');
      }

      user.email = user.pendingEmail;
      user.pendingEmail = undefined;
      user.pendingEmailVerified = false;
      user.isEmailVerified = true;
    }

    await user.save();

    return user;
  }

  async requestEmailVerification(userId: string, email: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const otp = generateOtp();

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    if (email !== user.email) {
      const existingUser = await this.usersRepository.findByEmail(email);

      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }

      await this.usersRepository.updateById(userId, {
        pendingEmail: email,
        pendingEmailVerified: false,
        emailVerificationToken: hashedOtp,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
      });
    } else {
      if (user.isEmailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      await this.usersRepository.updateById(userId, {
        emailVerificationToken: hashedOtp,
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
      });
    }

    await this.mailService.sendResetCode(email, otp, 'Email Verification Code');

    return {
      message: 'Verification code sent successfully',
    };
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    if (
      !user.emailVerificationToken ||
      !user.emailVerificationExpires ||
      user.emailVerificationExpires < new Date()
    ) {
      throw new BadRequestException('Verification code expired');
    }

    if (hashedCode !== user.emailVerificationToken) {
      throw new BadRequestException('Invalid verification code');
    }

    const updateData: any = {
      emailVerificationToken: undefined,
      emailVerificationExpires: undefined,
    };

    if (user.pendingEmail) {
      updateData.pendingEmailVerified = true;
    } else {
      updateData.isEmailVerified = true;
    }

    await this.usersRepository.updateById(userId, updateData);

    return {
      message: 'Email verified successfully',
    };
  }

  async deleteAccount(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.profileImagePublicId) {
      await this.cloudinaryService.deleteImage(user.profileImagePublicId);
    }
    const deletedUser = await this.usersRepository.deleteById(userId);

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Account deleted successfully',
    };
  }
}
