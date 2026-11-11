import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSpecialtyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
