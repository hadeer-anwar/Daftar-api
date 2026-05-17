import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class UpdateSalaryDto {
  @ApiProperty({
    example: 5000,
    description: 'The monthly salary of the user',
  })
  @IsInt()
  @Min(0)
  monthlyIncome!: number;

  @ApiProperty({
    example: 1,
    description: 'The day of the month to reset the income',
  })
  @IsInt()
  @Min(1)
  @Max(31)
  resetDay!: number;
}
