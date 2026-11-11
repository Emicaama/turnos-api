import { BinnacleKind } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListBinnacleQueryDto {
  @IsOptional()
  @IsEnum(BinnacleKind)
  kind?: BinnacleKind;
}
