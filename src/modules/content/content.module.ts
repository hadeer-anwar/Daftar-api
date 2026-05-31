import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { Faq, FaqSchema } from './schemas/faq.schema';
import { Content, ContentSchema } from './schemas/content.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ContentRepository } from './repositories/content.repository';
import { FaqRepository } from './repositories/faq.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Content.name,
        schema: ContentSchema,
      },
      {
        name: Faq.name,
        schema: FaqSchema,
      },
    ]),
  ],
  controllers: [ContentController],
  providers: [ContentService, ContentRepository, FaqRepository],
})
export class ContentModule {}
