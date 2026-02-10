import { Injectable } from "@nestjs/common";
import { hashSync } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
    });
  }

  async create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashSync(dto.password, 10),
        role: dto.role ?? undefined,
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, updatedAt: true },
    });
  }

  async getByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}

