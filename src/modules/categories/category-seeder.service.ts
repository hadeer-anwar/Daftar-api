import { Injectable } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { CategoryRepository } from './repositories/category.repository';
import { DEFAULT_CATEGORIES } from './constants/default-categories';

@Injectable()
export class CategorySeederService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async seedDefaultCategories(userId: string) {
    const hasCategories = await this.categoryRepository.hasCategories(userId);

    if (hasCategories) {
      return;
    }

    await this.categoryRepository.createMany(
      DEFAULT_CATEGORIES.map((category) => ({
        ...category,
        userId: new ObjectId(userId),
      })),
    );
  }
}
