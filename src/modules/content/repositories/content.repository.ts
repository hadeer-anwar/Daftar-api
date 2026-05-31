import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';

import { Content } from '../schemas/content.schema';
import { ContentType } from '../schemas/content.schema';

@Injectable()
export class ContentRepository {
  constructor(
    @InjectModel(Content.name)
    private readonly contentModel: Model<Content>,
  ) {}

  async findByKey(key: ContentType): Promise<Content | null> {
    return this.contentModel.findOne({ key });
  }

  async create(data: Partial<Content>): Promise<Content> {
    return this.contentModel.create(data);
  }

  async updateByKey(
    key: ContentType,
    data: Partial<Content>,
  ): Promise<Content | null> {
    return this.contentModel.findOneAndUpdate({ key }, data, { new: true });
  }
}
