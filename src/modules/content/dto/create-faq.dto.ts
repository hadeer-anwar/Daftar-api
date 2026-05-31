import { IsBoolean, IsNumber, IsObject, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFaqDto {
  @ApiProperty({
    example: {
      en: 'How do I add an expense?',
      ar: 'كيف أضيف مصروف؟',
    },
  })
  @IsObject()
  question!: Record<string, string>;

  @ApiProperty({
    example: {
      en: 'Go to Add Expense screen.',
      ar: 'اذهب إلى شاشة إضافة المصروف.',
    },
  })
  @IsObject()
  answer!: Record<string, string>;

  @ApiProperty({
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiProperty({
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
