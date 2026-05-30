import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';

import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetCodeDto } from './dto/verify-reset-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendResetCodeDto } from './dto/resend-reset-code.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(@Req() req: any) {
    // Successful authentication, generate JWT and create user in DB
    return this.authService.googleSignIn({
      email: req.user.email,
      name: req.user.name,
      googleId: req.user.googleId,
    });
  }

  @Post('forgot-password')
  forgotPassword(
    @Body()
    dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto);
  }

  @Post('verify-reset-code')
  verifyResetCode(
    @Body()
    dto: VerifyResetCodeDto,
  ) {
    return this.authService.verifyResetCode(dto);
  }

  @Post('reset-password')
  resetPassword(
    @Body()
    dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(dto);
  }

  @Post('resend-reset-code')
  resendResetCode(
    @Body()
    dto: ResendResetCodeDto,
  ) {
    return this.authService.resendResetCode(dto);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto) {
    const refreshToken = body.refreshToken;
    return this.authService.refresh(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('accessToken')
  @Patch('change-password')
  changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangePasswordDto,
  ) {
    // console.log('User ID from token:', user.userId);
    // console.log('ChangePasswordDto:', dto);
    return this.authService.changePassword(user.userId, dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: CurrentUserData) {
    return this.authService.logout(user.userId);
  }
}
