import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePhaseDto } from "./dto/create-phase.dto";
import { CreateWorkDto } from "./dto/create-work.dto";
import { UpdatePhaseDto } from "./dto/update-phase.dto";
import { UpdateWorkDto } from "./dto/update-work.dto";

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async listWorks() {
    return this.prisma.work.findMany({
      orderBy: { createdAt: "desc" },
      include: { phases: { orderBy: { order: "asc" } } },
    });
  }

  async getWork(id: string) {
    const work = await this.prisma.work.findUnique({
      where: { id },
      include: { phases: { orderBy: { order: "asc" } } },
    });
    if (!work) throw new NotFoundException("Work not found");
    return work;
  }

  async createWork(dto: CreateWorkDto) {
    return this.prisma.work.create({
      data: { name: dto.name, code: dto.code ?? null },
    });
  }

  async updateWork(id: string, dto: UpdateWorkDto) {
    const existing = await this.prisma.work.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Work not found");

    return this.prisma.work.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        code: dto.code === undefined ? undefined : dto.code,
        active: dto.active ?? undefined,
      },
    });
  }

  async listPhases(workId: string) {
    return this.prisma.phase.findMany({
      where: { workId },
      orderBy: { order: "asc" },
    });
  }

  async createPhase(workId: string, dto: CreatePhaseDto) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException("Work not found");

    return this.prisma.phase.create({
      data: {
        workId,
        name: dto.name,
        order: dto.order ?? 0,
      },
    });
  }

  async updatePhase(id: string, dto: UpdatePhaseDto) {
    const existing = await this.prisma.phase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Phase not found");

    return this.prisma.phase.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        order: dto.order ?? undefined,
        active: dto.active ?? undefined,
      },
    });
  }
}

