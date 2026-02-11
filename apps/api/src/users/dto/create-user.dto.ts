import { PerfilUsuario } from '@bim-audit/db';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(PerfilUsuario)
  @IsOptional()
  perfil?: PerfilUsuario;
}
