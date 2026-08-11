// statistics.controller.ts
import {
  Controller,
  Get,
  NotFoundException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsParamsDto } from './dto/statistics-params.dto';
import { StatisticsService } from './statistics.service';

type StatisticsCategory = {
  categoryId?: string | number;
};

type StatisticsResponse = {
  categories?: StatisticsCategory[];
  [key: string]: unknown;
};

@ApiTags('Statistics')
@Controller('statistics')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}

  @ApiOperation({
    summary: 'Get aggregated statistics for a specified time frame',
  })
  @Get()
  async getStatistics(
    @CurrentUser() user: CurrentUserData,
    @Query() query: StatisticsParamsDto,
  ): Promise<StatisticsResponse> {
    const statistics = await this.statisticsService.getStatisticsAggregated(
      user.userId,
      query,
    );
    if (!statistics) {
      throw new NotFoundException(
        'Statistics not found for the specified parameters',
      );
    }
    return this.normalizeStatisticsResponse(statistics);
  }

  private normalizeStatisticsResponse(
    response: StatisticsResponse,
  ): StatisticsResponse {
    if (!response.categories) {
      return response;
    }
    const categories =
      response.categories?.map((category) => ({
        ...category,
        categoryId:
          category.categoryId && typeof category.categoryId !== 'string'
            ? String(category.categoryId)
            : category.categoryId,
      })) ?? [];

    return {
      ...response,
      categories,
    };
  }
}
