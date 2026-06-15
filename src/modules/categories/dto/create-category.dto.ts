import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Food',
    description: 'The name of the category',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: '#FF5733',
    description: 'The color associated with the category',
  })
  @IsString()
  color?: string;

  @ApiProperty({
    example: '#C70039',
    description: 'The background color associated with the category',
  })
  @IsString()
  backgroundColor?: string;

  @ApiProperty({
    example: '#900C3F',
    description: 'The border color associated with the category',
  })
  @IsString()
  borderColor?: string;

  @ApiProperty({
    example: 'fa-solid fa-utensils',
    description: 'The icon associated with the category',
  })
  @IsString()
  icon?: string;
}
