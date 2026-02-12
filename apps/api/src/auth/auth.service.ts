import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const emailNorm = email.trim().toLowerCase();
    const user = await this.prisma.dimUsuario.findUnique({
      where: { email: emailNorm },
    });
    if (!user || !user.ativo)
      throw new UnauthorizedException('Invalid credentials');
    if (!user.senhaHash || !compareSync(password, user.senhaHash))
      throw new UnauthorizedException('Invalid credentials');

    const payload: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.nomeCompleto,
      role: user.perfil,
      perfil: user.perfil,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: payload,
    };
  }
}
