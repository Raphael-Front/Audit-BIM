import { Injectable } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.dimUsuario.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        perfil: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateUserDto) {
    return this.prisma.dimUsuario.create({
      data: {
        nomeCompleto: dto.name,
        email: dto.email,
        senhaHash: hashSync(dto.password, 10),
        perfil: dto.perfil ?? undefined,
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        perfil: true,
        ativo: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getByEmail(email: string) {
    return this.prisma.dimUsuario.findUnique({ where: { email } });
  }
}
