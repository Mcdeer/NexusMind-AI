import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { MessageRole } from '@prisma/client';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsEnum(MessageRole)
  role?: MessageRole;
}
