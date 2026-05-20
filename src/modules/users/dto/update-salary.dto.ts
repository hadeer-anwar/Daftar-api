import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateSalaryDto {
  @ApiProperty({
    example: 5000,
    description: 'The monthly salary of the user',
  })
  @IsInt()
  @Min(0)
  monthlyIncome!: number;

  @ApiProperty({
    example: new Date(),
    description: 'The date of the month to pay the user salary',
  })
  payDate!: Date;
}
