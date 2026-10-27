import { IsUUID } from 'class-validator';

export class ListTriageQueryDto {
  @IsUUID()
  branchId: string;
}
