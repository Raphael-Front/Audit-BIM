import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { UpdateWorkDto } from './dto/update-work.dto';

@Injectable()
export class WorksService {
  constructor(private readonly prisma: PrismaService) {}

  async listWorks() {
    return this.prisma.dimObra.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWork(id: string) {
    const work = await this.prisma.dimObra.findFirst({
      where: { id, deletedAt: null },
    });
    if (!work) throw new NotFoundException('Work not found');
    return work;
  }

  async createWork(dto: CreateWorkDto) {
    const codigo =
      dto.code?.trim() ||
      dto.name.replace(/\s+/g, '_').toUpperCase().slice(0, 50) ||
      'OBRA';
    return this.prisma.dimObra.create({
      data: { nome: dto.name, codigo },
    });
  }

  async updateWork(id: string, dto: UpdateWorkDto) {
    const existing = await this.prisma.dimObra.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Work not found');

    return this.prisma.dimObra.update({
      where: { id },
      data: {
        nome: dto.name ?? undefined,
        codigo: dto.code === undefined ? undefined : dto.code ?? undefined,
        ativo: dto.active ?? undefined,
      },
    });
  }

  /** No schema dimensional, fases são globais (DimFase). workId mantido na rota por compatibilidade. */
  async listPhases(_workId: string) {
    return this.prisma.dimFase.findMany({
      where: { ativo: true },
      orderBy: { ordemSequencial: 'asc' },
    });
  }

  async createPhase(_workId: string, dto: CreatePhaseDto) {
    const codigo =
      dto.name.replace(/\s+/g, '_').toUpperCase().slice(0, 20) || 'FASE';
    return this.prisma.dimFase.create({
      data: {
        nome: dto.name,
        codigo,
        ordemSequencial: dto.order ?? 0,
      },
    });
  }

  async updatePhase(id: string, dto: UpdatePhaseDto) {
    const existing = await this.prisma.dimFase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Phase not found');

    return this.prisma.dimFase.update({
      where: { id },
      data: {
        nome: dto.name ?? undefined,
        ordemSequencial: dto.order ?? undefined,
        ativo: dto.active ?? undefined,
      },
    });
  }
}
