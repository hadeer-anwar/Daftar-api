import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { UsersRepository } from '../users/repositories/users.repository';
import { MailService } from '../mail/mail.service';

import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthProvider } from '../users/schemas/user.schema';

import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendResetCodeDto } from './dto/resend-reset-code.dto';

import { generateOtp } from '../../common/utils/generate-otp';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  // =========================
  // SIGNUP
  // =========================
  async signup(dto: SignupDto) {
    const existing = await this.usersRepo.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersRepo.create({
      ...dto,
      password: hashedPassword,
    });
    const { accessToken, refreshToken } = this.generateTokens(user);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.usersRepo.updateById(user._id.toString(), {
      hashedRefreshToken,
    });

    return { accessToken, refreshToken };
  }

  // =========================
  // LOGIN
  // =========================
  async login(dto: LoginDto) {
    const user = await this.usersRepo.findByEmail(dto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { accessToken, refreshToken } = this.generateTokens(user);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.usersRepo.updateById(user._id.toString(), {
      hashedRefreshToken,
      lastLoginAt: new Date(),
    });

    return { accessToken, refreshToken };
  }

  // =========================
  // GOOGLE LOGIN
  // =========================
  async googleSignIn(user: any) {
    let existingUser = await this.usersRepo.findByEmail(user.email);

    if (!existingUser) {
      existingUser = await this.usersRepo.create({
        name: user.name,
        email: user.email,
        googleId: user.googleId,
        provider: AuthProvider.GOOGLE,
      });
    }

    const { accessToken, refreshToken } = this.generateTokens(existingUser);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.usersRepo.updateById(existingUser._id.toString(), {
      hashedRefreshToken,
      lastLoginAt: new Date(),
    });

    return { accessToken, refreshToken };
  }

  // =========================
  // FORGOT PASSWORD
  // =========================
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersRepo.findByEmail(dto.email);

    if (!user) {
      return {
        message: 'If this email exists, a reset code was sent',
      };
    }

    if (
      user.resetPasswordBlockedUntil &&
      user.resetPasswordBlockedUntil > new Date()
    ) {
      throw new HttpException('Too many attempts. Try again later.', 429);
    }

    const cooldown =
      user.resetPasswordLastSentAt &&
      Date.now() - new Date(user.resetPasswordLastSentAt).getTime() < 60 * 1000;

    if (cooldown) {
      throw new BadRequestException(
        'Please wait before requesting another code',
      );
    }

    const otp = generateOtp();

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    await this.usersRepo.updateById(user._id.toString(), {
      passwordResetToken: hashedOtp,
      passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
      resetPasswordAttempts: 0,
      resetPasswordLastSentAt: new Date(),
    });

    await this.mailService.sendResetCode(user.email, otp);

    return {
      success: true,
      message: 'Reset code sent successfully',
    };
  }

  // =========================
  // VERIFY RESET CODE
  // =========================
  async verifyResetCode(dto: VerifyResetCodeDto) {
    const hashedCode = crypto
      .createHash('sha256')
      .update(dto.code)
      .digest('hex');

    const user = await this.usersRepo.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid code');
    }

    if (
      user.resetPasswordBlockedUntil &&
      user.resetPasswordBlockedUntil > new Date()
    ) {
      throw new HttpException('Too many attempts. Try again later.', 429);
    }

    const isExpired =
      !user.passwordResetExpires || user.passwordResetExpires < new Date();

    const isInvalid = user.passwordResetToken !== hashedCode;

    if (isExpired || isInvalid) {
      const attempts = (user.resetPasswordAttempts || 0) + 1;

      const updateData: any = {
        resetPasswordAttempts: attempts,
      };

      if (attempts >= 5) {
        updateData.resetPasswordBlockedUntil = new Date(
          Date.now() + 15 * 60 * 1000,
        );
      }

      await this.usersRepo.updateById(user._id.toString(), updateData);

      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.usersRepo.updateById(user._id.toString(), {
      resetPasswordAttempts: 0,
    });

    return {
      success: true,
      message: 'Code verified successfully',
    };
  }

  // =========================
  // RESET PASSWORD
  // =========================
  async resetPassword(dto: ResetPasswordDto) {
    const hashedCode = crypto
      .createHash('sha256')
      .update(dto.code)
      .digest('hex');

    const user = await this.usersRepo.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid code');
    }

    const isExpired =
      !user.passwordResetExpires || user.passwordResetExpires < new Date();

    const isInvalid = user.passwordResetToken !== hashedCode;

    if (isExpired || isInvalid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.usersRepo.updateById(user._id.toString(), {
      password: hashedPassword,

      passwordResetToken: undefined,
      passwordResetExpires: undefined,
      resetPasswordAttempts: 0,
      resetPasswordBlockedUntil: undefined,
      resetPasswordLastSentAt: undefined,

      hashedRefreshToken: null,

      // 🔥 SECURITY: invalidate all sessions
      tokenVersion: user.tokenVersion + 1,
    });

    return {
      message: 'Password reset successfully',
    };
  }

  // =========================
  // RESEND RESET CODE
  // =========================
  async resendResetCode(dto: ResendResetCodeDto) {
    return this.forgotPassword(dto);
  }

  // =========================
  // REFRESH TOKEN
  // =========================
  async refresh(refreshToken: string) {
    const payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: process.env.JWT_SECRET,
    });

    const user = await this.usersRepo.findById(payload.sub);

    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException();
    }

    const isValid = await bcrypt.compare(refreshToken, user.hashedRefreshToken);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    const tokens = this.generateTokens(user);

    const hashed = await bcrypt.hash(tokens.refreshToken, 10);

    await this.usersRepo.updateById(user._id.toString(), {
      hashedRefreshToken: hashed,
    });

    return tokens;
  }

  // =========================
  // LOGOUT
  // =========================
  async logout(userId: string) {
    const user = await this.usersRepo.findById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    await this.usersRepo.updateById(userId, {
      hashedRefreshToken: null,
      tokenVersion: user.tokenVersion + 1,
    });
  }

  private generateTokens(user) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }
}
