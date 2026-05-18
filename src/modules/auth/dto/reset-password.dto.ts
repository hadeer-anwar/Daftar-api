import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user resetting their password',
  })
  @IsEmail()
  email!: string;
  @ApiProperty({
    example: '1234',
    description:
      'The 4-digit code sent to the user for password reset verification',
  })
  @IsString()
  code!: string;
  @ApiProperty({
    example: 'newStrongPassword123',
    description: 'The new password that the user wants to set',
  })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
