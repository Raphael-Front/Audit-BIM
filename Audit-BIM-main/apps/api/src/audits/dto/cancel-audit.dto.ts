import { IsOptional, IsString } from 'class-validator';

export class CancelAuditDto {
  @IsOptional()
  @IsString()
  reason?: string | null;
}
