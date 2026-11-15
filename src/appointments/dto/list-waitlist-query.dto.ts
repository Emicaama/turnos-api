import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListWaitlistQueryDto {
  @IsOptional()
  @IsString()
  day?: string;

  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
