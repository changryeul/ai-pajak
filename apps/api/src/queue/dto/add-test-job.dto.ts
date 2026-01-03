import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AddTestJobDto {
  @ApiProperty({
    description: 'Test message to process',
    example: 'Hello Queue!',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
