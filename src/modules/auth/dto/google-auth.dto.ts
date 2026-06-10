import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google ID token obtained from the client',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2ODg5YjA4Y...',
  })
  @IsString()
  idToken!: string;
}
