import {
  Controller,
  Post,
  UseGuards,
  Body,
  Get,
  Param,
  Delete,
  Patch,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUserData } from '../../common/interfaces/current-user.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('categories')
@ApiBearerAuth('accessToken')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.categoriesService.createCategory(
      createCategoryDto,
      user.userId,
    );
  }
  @UseGuards(JwtAuthGuard)
  @Get()
  getAllCategories(@CurrentUser() user: CurrentUserData) {
    return this.categoriesService.getAllCategories(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  getCategoryById(@Param('id') id: string) {
    return this.categoriesService.getCategoryById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: CreateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(id, updateCategoryDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteCategory(@Param('id') id: string) {
    return this.categoriesService.deleteCategory(id);
  }
}
