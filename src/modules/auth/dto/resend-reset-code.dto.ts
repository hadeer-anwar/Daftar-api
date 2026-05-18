import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendResetCodeDto {
  @ApiProperty({
    example: 'user@example.com',
    description:
      'The email address of the user requesting to resend the reset code',
  })
  @IsEmail()
  email!: string;
}
