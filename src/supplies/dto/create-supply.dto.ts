import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateSupplyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsInt()
  @Min(0)
  stock: number;

  @IsInt()
  @Min(0)
  price: number;
}
