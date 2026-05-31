import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'The name of the user',
    example: 'new name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'The email of the user',
    example: 'newemail@example.com',
  })
  @IsOptional()
  @IsString()
  email?: string;
}
