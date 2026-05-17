import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersRepository } from '../users/repositories/users.repository';

import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthProvider } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

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

    return this.generateToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findByEmail(dto.email);

    if (!user || !user.password) {
      console.log('User not found or password missing for email:', dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) {
      console.log('Password does not match for email:', dto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

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

    return this.generateToken(existingUser);
  }

  private generateToken(user: any) {
    return {
      access_token: this.jwtService.sign({
        sub: user._id,
        email: user.email,
      }),
    };
  }
}
