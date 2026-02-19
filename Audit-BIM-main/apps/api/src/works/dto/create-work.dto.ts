import { IsOptional, IsString } from 'class-validator';

export class CreateWorkDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;
}
