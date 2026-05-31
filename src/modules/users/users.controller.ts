import {
  Controller,
  Delete,
  Get,
  UseGuards,
  Patch,
  Body,
  Post,
} from '@nestjs/common';

import { UsersService } from './users.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import type { CurrentUserData } from '../../common/interfaces/current-user.interface';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  RequestEmailVerificationDto,
  VerifyEmailDto,
} from './dto/email-verification.dto';

@ApiTags('users')
@ApiBearerAuth('accessToken')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@CurrentUser() user: CurrentUserData) {
    return this.usersService.getProfile(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('request-email-verification')
  requestEmailVerification(
    @CurrentUser() user: CurrentUserData,
    @Body() data: RequestEmailVerificationDto,
  ) {
    return this.usersService.requestEmailVerification(user.userId, data.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-email')
  verifyEmail(
    @CurrentUser() user: CurrentUserData,
    @Body() data: VerifyEmailDto,
  ) {
    return this.usersService.verifyEmail(user.userId, data.code);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() data: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(user.userId, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  deleteAccount(@CurrentUser() user: CurrentUserData) {
    return this.usersService.deleteAccount(user.userId);
  }
}
