import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';

import { Faq } from '../schemas/faq.schema';

@Injectable()
export class FaqRepository {
  constructor(
    @InjectModel(Faq.name)
    private readonly faqModel: Model<Faq>,
  ) {}

  async findAllActive(): Promise<Faq[]> {
    return this.faqModel.find({ isActive: true }).sort({ order: 1 });
  }

  async findById(id: string) {
    return this.faqModel.findById(id);
  }

  async create(data: Partial<Faq>) {
    return this.faqModel.create(data);
  }

  async updateById(id: string, data: Partial<Faq>) {
    return this.faqModel.findByIdAndUpdate(id, data, { new: true });
  }

  async deleteById(id: string) {
    return this.faqModel.findByIdAndDelete(id);
  }
}
