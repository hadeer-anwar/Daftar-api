import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Length, Matches } from 'class-validator';

export class VerifyResetCodeDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the user verifying the reset code',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '1234',
    description: 'The 4-digit code sent to the user for reset verification',
  })
  @Matches(/^\d+$/)
  @Length(4, 4)
  code!: string;
}
