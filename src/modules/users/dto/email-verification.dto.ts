import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
export class RequestEmailVerificationDto {
  @ApiProperty({
    description: 'The email to verify',
    example: 'user@example.com',
  })
  @IsString()
  email!: string;
}

export class VerifyEmailDto {
  @ApiProperty({
    description: 'The verification code sent to the email',
    example: '1234',
  })
  @IsString()
  code!: string;
}
