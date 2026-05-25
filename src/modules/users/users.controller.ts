import { Controller, Delete, Get, UseGuards } from '@nestjs/common';

import { UsersService } from './users.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { CurrentUser } from '../../common/decorators/current-user.decorator';

import type { CurrentUserData } from '../../common/interfaces/current-user.interface';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
  @Delete('me')
  deleteAccount(@CurrentUser() user: CurrentUserData) {
    return this.usersService.deleteAccount(user.userId);
  }
}
