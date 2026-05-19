import { Body, Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
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
  @UseGuards(JwtAuthGuard)
  refresh(@Body() body: any, @CurrentUser() user: any) {
    const userId = user.userId;
    const refreshToken = body.refreshToken;
    return this.authService.refresh(userId, refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: any) {
    return this.authService.logout(user.userId);
  }
}
