import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWorkDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
