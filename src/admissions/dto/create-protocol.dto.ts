import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';
import { normalizeReason } from '../protocols';

export class CreateProtocolDto {
  @Transform(({ value }) => normalizeReason(value))
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  tasks: string[];
}
