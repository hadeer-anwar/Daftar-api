import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
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
      'Year for monthly or weekly statistics (required if timeFrame is month or week)',
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
    description:
      'Week number for weekly statistics (required if timeFrame is week)',
    example: 20,
  })
  @IsOptional()
  week?: number;
}
