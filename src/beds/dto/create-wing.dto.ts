import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateWingDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsInt()
  @Min(1)
  @Max(9)
  code: number;

  @IsOptional()
  @IsString()
  description?: string;
}
