// statistics.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatisticsAggregationService } from './statistics-aggregation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsResponse } from './statistics.service';
import { StatisticsParamsDto } from './dto/statistics-params.dto';

@ApiTags('Statistics')
@Controller('statistics')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private statisticsService: StatisticsAggregationService) {}

  @ApiOperation({
    summary: 'Get aggregated statistics for a specified time frame',
  })
  @Get()
  async getStatistics(
    @CurrentUser() user: CurrentUserData,
    @Query() query: StatisticsParamsDto,
  ): Promise<StatisticsResponse> {
    let date = new Date();

    if (query.year && query.month) {
      date = new Date(query.year, query.month - 1);
    } else if (query.year && query.week) {
      // Calculate date from year and week number
      date = this.getDateFromWeekNumber(query.year, query.week);
    }

    const statistics = await this.statisticsService.getStatisticsAggregated(
      user.userId,
      query.timeFrame,
      date,
    );

    return this.normalizeStatisticsResponse(
      statistics as unknown as Partial<StatisticsResponse>,
    );
  }

  private normalizeStatisticsResponse(
    response: Partial<StatisticsResponse>,
  ): StatisticsResponse {
    const categories =
      response.categories?.map((category) => ({
        ...category,
        categoryId:
          category.categoryId && typeof category.categoryId !== 'string'
            ? String(category.categoryId)
            : category.categoryId,
      })) ?? [];

    return {
      ...(response as StatisticsResponse),
      categories,
    };
  }

  private getDateFromWeekNumber(year: number, weekNumber: number): Date {
    const janFirst = new Date(year, 0, 1);
    const daysOffset = (weekNumber - 1) * 7;
    const targetDate = new Date(janFirst);
    targetDate.setDate(janFirst.getDate() + daysOffset);
    return targetDate;
  }
}
