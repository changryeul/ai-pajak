import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: '추가 자료를 업로드했습니다.' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}