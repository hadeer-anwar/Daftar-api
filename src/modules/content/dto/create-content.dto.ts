import { IsEnum, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ContentType {
  TERMS = 'terms',
  PRIVACY = 'privacy',
}

export class CreateContentDto {
  @ApiProperty({
    enum: ContentType,
    example: ContentType.PRIVACY,
  })
  @IsEnum(ContentType)
  key!: ContentType;

  @ApiProperty({
    example: {
      en: 'Privacy Policy',
      ar: 'سياسة الخصوصية',
    },
  })
  @IsObject()
  title!: Record<string, string>;

  @ApiProperty({
    example: {
      en: 'Your privacy policy text...',
      ar: 'نص سياسة الخصوصية...',
    },
  })
  @IsObject()
  content!: Record<string, string>;
}
