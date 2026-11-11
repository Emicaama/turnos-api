import { IsString, MinLength } from 'class-validator';

export class CreateBedDto {
  @IsString()
  @MinLength(1)
  number: string;
}
