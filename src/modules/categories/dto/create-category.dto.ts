import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Food',
    description: 'The name of the category',
  })
  name!: string;

  @ApiProperty({
    example: '#FF5733',
    description: 'The color associated with the category',
  })
  color?: string;

  @ApiProperty({
    example: 'fa-solid fa-utensils',
    description: 'The icon associated with the category',
  })
  icon?: string;
}
