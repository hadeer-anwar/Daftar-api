import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentRepository } from './repositories/content.repository';
import { FaqRepository } from './repositories/faq.repository';
import { ContentType } from './schemas/content.schema';
import { CreateFaqDto } from './dto/create-faq.dto';
import { CreateContentDto } from './dto/create-content.dto';
@Injectable()
export class ContentService {
  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly faqRepo: FaqRepository,
  ) {}

  async getContent(key: ContentType, lang: string) {
    const content = await this.contentRepo.findByKey(key);

    if (!content) {
      throw new NotFoundException(`Content with key ${key} not found`);
    }

    return {
      title: content.title?.get(lang),
      content: content.content?.get(lang),
    };
  }

  async getFaqs(lang: string) {
    const faqs = await this.faqRepo.findAllActive();

    return faqs.map((faq) => ({
      id: faq.order,
      question: faq.question.get(lang),
      answer: faq.answer.get(lang),
    }));
  }

  async createContent(dto: CreateContentDto) {
    const data = {
      ...dto,
      title: new Map(Object.entries(dto.title)),
      content: new Map(Object.entries(dto.content)),
    };

    return this.contentRepo.create(data);
  }

  async createFaq(dto: CreateFaqDto) {
    const data = {
      ...dto,
      question: new Map(Object.entries(dto.question)),
      answer: new Map(Object.entries(dto.answer)),
    };

    return this.faqRepo.create(data);
  }
}
