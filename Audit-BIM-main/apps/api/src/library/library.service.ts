import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditPhaseDto } from './dto/create-audit-phase.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { CreateDisciplineDto } from './dto/create-discipline.dto';
import { UpdateAuditPhaseDto } from './dto/update-audit-phase.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { UpdateDisciplineDto } from './dto/update-discipline.dto';

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  listAuditPhases(active?: boolean) {
    return this.prisma.dimFase.findMany({
      where: active === undefined ? undefined : { ativo: active },
      orderBy: [{ ordemSequencial: 'asc' }, { nome: 'asc' }],
    });
  }

  createAuditPhase(dto: CreateAuditPhaseDto) {
    const codigo =
      (dto.label || dto.name).replace(/\s+/g, '_').toUpperCase().slice(0, 20) ||
      'FASE';
    return this.prisma.dimFase.create({
      data: {
        nome: dto.name,
        codigo,
        descricao: dto.label ?? undefined,
        ordemSequencial: dto.order ?? 0,
        ativo: dto.active ?? true,
      },
    });
  }

  async updateAuditPhase(id: string, dto: UpdateAuditPhaseDto) {
    const existing = await this.prisma.dimFase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Audit phase not found');
    return this.prisma.dimFase.update({
      where: { id },
      data: {
        nome: dto.name ?? undefined,
        descricao: dto.label ?? undefined,
        ordemSequencial: dto.order ?? undefined,
        ativo: dto.active ?? undefined,
      },
    });
  }

  listDisciplines() {
    return this.prisma.dimDisciplina.findMany({
      where: { ativo: true },
      orderBy: { codigo: 'asc' },
    });
  }

  createDiscipline(dto: CreateDisciplineDto) {
    const codigo =
      dto.name.replace(/\s+/g, '_').toUpperCase().slice(0, 20) || 'DISC';
    return this.prisma.dimDisciplina.create({
      data: {
        nome: dto.name,
        codigo,
      },
    });
  }

  async updateDiscipline(id: string, dto: UpdateDisciplineDto) {
    const existing = await this.prisma.dimDisciplina.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Discipline not found');
    return this.prisma.dimDisciplina.update({
      where: { id },
      data: {
        nome: dto.name ?? undefined,
        ativo: dto.active ?? undefined,
      },
    });
  }

  async listCategories(disciplineId?: string) {
    if (!disciplineId) {
      return this.prisma.dimCategoria.findMany({
        where: { ativo: true },
        orderBy: [{ ordemExibicao: 'asc' }, { nome: 'asc' }],
        include: { disciplinas: true },
      });
    }
    const links = await this.prisma.dimCategoriaDisciplina.findMany({
      where: { disciplinaId: disciplineId },
      orderBy: { ordemExibicao: 'asc' },
      include: { categoria: true },
    });
    return links
      .filter((l) => l.categoria.ativo)
      .map((l) => ({
        ...l.categoria,
        disciplinaId: disciplineId,
        ordemExibicao: l.ordemExibicao,
        disciplina: { id: disciplineId },
      }));
  }

  async createCategory(dto: CreateCategoryDto) {
    const d = await this.prisma.dimDisciplina.findUnique({
      where: { id: dto.disciplineId },
    });
    if (!d) throw new NotFoundException('Discipline not found');
    const codigo =
      dto.name.replace(/\s+/g, '_').toUpperCase().slice(0, 50) || 'CAT';
    const categoria = await this.prisma.dimCategoria.create({
      data: {
        nome: dto.name,
        codigo,
        ordemExibicao: dto.order ?? 0,
      },
    });
    await this.prisma.dimCategoriaDisciplina.create({
      data: {
        categoriaId: categoria.id,
        disciplinaId: dto.disciplineId,
        ordemExibicao: dto.order ?? 0,
      },
    });
    return this.prisma.dimCategoria.findUnique({
      where: { id: categoria.id },
      include: {
        disciplinas: { include: { disciplina: true } },
      },
    });
  }

  async linkCategoryToDiscipline(
    categoryId: string,
    disciplineId: string,
    order?: number,
  ) {
    const [cat, disc] = await Promise.all([
      this.prisma.dimCategoria.findUnique({ where: { id: categoryId } }),
      this.prisma.dimDisciplina.findUnique({ where: { id: disciplineId } }),
    ]);
    if (!cat) throw new NotFoundException('Category not found');
    if (!disc) throw new NotFoundException('Discipline not found');
    const existing = await this.prisma.dimCategoriaDisciplina.findUnique({
      where: {
        categoriaId_disciplinaId: { categoriaId: categoryId, disciplinaId: disciplineId },
      },
    });
    if (existing)
      throw new BadRequestException('Category already linked to this discipline');
    const nextOrder =
      order ??
      (await this.prisma.dimCategoriaDisciplina
        .aggregate({
          where: { disciplinaId: disciplineId },
          _max: { ordemExibicao: true },
        })
        .then((r) => (r._max.ordemExibicao ?? -1) + 1));
    return this.prisma.dimCategoriaDisciplina.create({
      data: {
        categoriaId: categoryId,
        disciplinaId: disciplineId,
        ordemExibicao: nextOrder,
      },
      include: { categoria: true, disciplina: true },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.dimCategoria.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Category not found');
    return this.prisma.dimCategoria.update({
      where: { id },
      data: {
        nome: dto.name ?? undefined,
        ordemExibicao: dto.order ?? undefined,
        ativo: dto.active ?? undefined,
      },
    });
  }

  listChecklistItems(params?: {
    categoryId?: string;
    auditPhaseId?: string;
    active?: boolean;
  }) {
    const where: {
      ativo?: boolean;
      categoriaId?: string;
      aplicabilidadeFases?: { some: { faseId: string } };
    } = {
      ativo: params?.active,
      categoriaId: params?.categoryId,
    };
    if (params?.auditPhaseId) {
      where.aplicabilidadeFases = {
        some: { faseId: params.auditPhaseId },
      };
    }
    return this.prisma.tblChecklistTemplate.findMany({
      where,
      orderBy: [{ ordemExibicao: 'desc' }, { createdAt: 'desc' }],
      include: {
        categoria: true,
        disciplina: true,
        aplicabilidadeFases: { include: { fase: true } },
      },
    });
  }

  async createChecklistItem(dto: CreateChecklistItemDto) {
    const [link, phase] = await Promise.all([
      this.prisma.dimCategoriaDisciplina.findUnique({
        where: {
          categoriaId_disciplinaId: {
            categoriaId: dto.categoryId,
            disciplinaId: dto.disciplineId,
          },
        },
      }),
      this.prisma.dimFase.findUnique({ where: { id: dto.auditPhaseId } }),
    ]);
    if (!link) throw new NotFoundException('Category not linked to this discipline');
    if (!phase) throw new NotFoundException('Audit phase not found');

    const template = await this.prisma.tblChecklistTemplate.create({
      data: {
        disciplinaId: dto.disciplineId,
        categoriaId: dto.categoryId,
        itemVerificacao: dto.description,
        peso: dto.weight ?? 1,
        pontosMaximo: dto.maxPoints ?? 10,
      },
    });
    await this.prisma.tblTemplateAplicabilidadeFase.create({
      data: {
        templateItemId: template.id,
        faseId: dto.auditPhaseId,
      },
    });
    return this.prisma.tblChecklistTemplate.findUnique({
      where: { id: template.id },
      include: {
        categoria: true,
        disciplina: true,
        aplicabilidadeFases: { include: { fase: true } },
      },
    });
  }

  async updateChecklistItem(id: string, dto: UpdateChecklistItemDto) {
    const existing = await this.prisma.tblChecklistTemplate.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Checklist item not found');

    if (dto.auditPhaseId !== undefined) {
      const phase = await this.prisma.dimFase.findUnique({
        where: { id: dto.auditPhaseId },
      });
      if (!phase) throw new NotFoundException('Audit phase not found');
      await this.prisma.tblTemplateAplicabilidadeFase.deleteMany({
        where: { templateItemId: id },
      });
      await this.prisma.tblTemplateAplicabilidadeFase.create({
        data: { templateItemId: id, faseId: dto.auditPhaseId },
      });
    }

    return this.prisma.tblChecklistTemplate.update({
      where: { id },
      data: {
        itemVerificacao: dto.description ?? undefined,
        peso: dto.weight ?? undefined,
        pontosMaximo: dto.maxPoints ?? undefined,
        ativo: dto.active ?? undefined,
      },
    });
  }
}
