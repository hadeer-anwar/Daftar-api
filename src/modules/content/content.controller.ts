import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ContentService } from './content.service';
import { ContentType } from './schemas/content.schema';
import { CreateFaqDto } from './dto/create-faq.dto';
import { CreateContentDto } from './dto/create-content.dto';
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}
  @Post()
  @ApiOperation({
    summary: 'Create privacy policy or terms',
  })
  createContent(@Body() dto: CreateContentDto) {
    return this.contentService.createContent(dto);
  }

  @Post('faq')
  @ApiOperation({
    summary: 'Create FAQ',
  })
  createFaq(@Body() dto: CreateFaqDto) {
    return this.contentService.createFaq(dto);
  }
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'ar'],
    example: 'en',
  })
  @Get('faq')
  getFaqs(@Query('lang') lang = 'en') {
    return this.contentService.getFaqs(lang);
  }

  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'ar'],
    example: 'en',
  })
  @Get('terms')
  getTerms(@Query('lang') lang = 'en') {
    return this.contentService.getContent(ContentType.TERMS, lang);
  }

  @Get('privacy')
  getPrivacy(@Query('lang') lang = 'en') {
    return this.contentService.getContent(ContentType.PRIVACY, lang);
  }
}
