import { InjectModel } from '@nestjs/mongoose';
import { Category, CategoryDocument } from '../schemas/category.schema';
import { Model, Types } from 'mongoose';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

export class CategoryRepository {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async create(data: CreateCategoryDto & { userId: Types.ObjectId }) {
    return this.categoryModel.create(data);
  }

  async findById(categoryId: string) {
    return this.categoryModel.findById(categoryId);
  }

  async findAll(userId: Types.ObjectId) {
    return this.categoryModel.find({ userId });
  }

  async updateById(categoryId: string, data: UpdateCategoryDto) {
    return this.categoryModel.findByIdAndUpdate(categoryId, data, {
      new: true,
      runValidators: true,
    });
  }

  async deleteById(categoryId: string) {
    return this.categoryModel.findByIdAndDelete(categoryId);
  }
}
