import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { TimeFrame } from '../statistics.service';
export class StatisticsParamsDto {
  @ApiPropertyOptional({
    description: 'Time frame for statistics aggregation',
    enum: TimeFrame,
    example: TimeFrame.MONTH,
  })
  @IsEnum(TimeFrame)
  timeFrame!: TimeFrame;

  @ApiPropertyOptional({
    description:
      'Year for monthly or yearly statistics (required if timeFrame is month or year)',
    example: 2024,
  })
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({
    description:
      'Month for monthly statistics (required if timeFrame is month)',
    example: 5,
  })
  @IsOptional()
  month?: number;
  @ApiPropertyOptional({
    description: 'Custom start date for weekly statistics',
    example: '2026-06-02',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Custom end date for weekly statistics',
    example: '2026-06-08',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Date for daily statistics (required if timeFrame is day)',
    example: '2026-06-02',
  })
  @ValidateIf((o: StatisticsParamsDto) => o.timeFrame === TimeFrame.DAY)
  @IsNotEmpty({ message: 'date is required when timeFrame is day' })
  @IsDateString({}, { message: 'date must be a valid ISO date string' })
  date?: string;
}
