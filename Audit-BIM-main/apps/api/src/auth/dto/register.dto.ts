import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nomeCompleto!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

