import { Injectable } from '@nestjs/common';
import { CategoryRepository } from './repositories/category.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Types } from 'mongoose';
import { UpdateCategoryDto } from './dto/update-category.dto';
@Injectable()
export class CategoriesService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async createCategory(data: CreateCategoryDto, userId: string) {
    const userIdObj = new Types.ObjectId(userId);
    return this.categoryRepository.create({ ...data, userId: userIdObj });
  }

  async getCategoryById(categoryId: string) {
    return this.categoryRepository.findById(categoryId);
  }

  async getAllCategories(userId: string) {
    const userIdObj = new Types.ObjectId(userId);
    return this.categoryRepository.findAll(userIdObj);
  }

  async updateCategory(categoryId: string, data: UpdateCategoryDto) {
    return this.categoryRepository.updateById(categoryId, data);
  }

  async deleteCategory(categoryId: string) {
    return this.categoryRepository.deleteById(categoryId);
  }
}
