import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAuditPhaseDto } from "./dto/create-audit-phase.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateChecklistItemDto } from "./dto/create-checklist-item.dto";
import { CreateDisciplineDto } from "./dto/create-discipline.dto";
import { UpdateAuditPhaseDto } from "./dto/update-audit-phase.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateChecklistItemDto } from "./dto/update-checklist-item.dto";
import { UpdateDisciplineDto } from "./dto/update-discipline.dto";

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  // Audit phases (PL, LO, etc.)
  listAuditPhases(active?: boolean) {
    return this.prisma.auditPhase.findMany({
      where: active === undefined ? undefined : { active },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  createAuditPhase(dto: CreateAuditPhaseDto) {
    return this.prisma.auditPhase.create({
      data: {
        name: dto.name,
        label: dto.label,
        order: dto.order ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updateAuditPhase(id: string, dto: UpdateAuditPhaseDto) {
    const existing = await this.prisma.auditPhase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Audit phase not found");
    return this.prisma.auditPhase.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        label: dto.label ?? undefined,
        order: dto.order ?? undefined,
        active: dto.active ?? undefined,
      },
    });
  }

  // Disciplines
  listDisciplines() {
    return this.prisma.discipline.findMany({ orderBy: { order: "asc" } });
  }

  createDiscipline(dto: CreateDisciplineDto) {
    return this.prisma.discipline.create({
      data: { name: dto.name, order: dto.order ?? 0 },
    });
  }

  async updateDiscipline(id: string, dto: UpdateDisciplineDto) {
    const existing = await this.prisma.discipline.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Discipline not found");
    return this.prisma.discipline.update({
      where: { id },
      data: { name: dto.name ?? undefined, order: dto.order ?? undefined, active: dto.active ?? undefined },
    });
  }

  // Categories
  listCategories(disciplineId?: string) {
    return this.prisma.category.findMany({
      where: disciplineId ? { disciplineId } : undefined,
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    const d = await this.prisma.discipline.findUnique({ where: { id: dto.disciplineId } });
    if (!d) throw new NotFoundException("Discipline not found");
    return this.prisma.category.create({
      data: { disciplineId: dto.disciplineId, name: dto.name, order: dto.order ?? 0 },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Category not found");
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name ?? undefined, order: dto.order ?? undefined, active: dto.active ?? undefined },
    });
  }

  // Checklist items (template)
  listChecklistItems(params?: { categoryId?: string; auditPhaseId?: string; active?: boolean }) {
    return this.prisma.checklistItem.findMany({
      where: {
        categoryId: params?.categoryId,
        auditPhaseId: params?.auditPhaseId,
        active: params?.active,
      },
      orderBy: [{ createdAt: "desc" }],
      include: {
        category: { include: { discipline: true } },
        auditPhase: true,
      },
    });
  }

  async createChecklistItem(dto: CreateChecklistItemDto) {
    const [cat, phase] = await Promise.all([
      this.prisma.category.findUnique({ where: { id: dto.categoryId } }),
      this.prisma.auditPhase.findUnique({ where: { id: dto.auditPhaseId } }),
    ]);
    if (!cat) throw new NotFoundException("Category not found");
    if (!phase) throw new NotFoundException("Audit phase not found");
    return this.prisma.checklistItem.create({
      data: {
        categoryId: dto.categoryId,
        auditPhaseId: dto.auditPhaseId,
        code: dto.code ?? null,
        description: dto.description,
        weight: dto.weight ?? 1,
        maxPoints: dto.maxPoints ?? 10,
      },
    });
  }

  async updateChecklistItem(id: string, dto: UpdateChecklistItemDto) {
    const existing = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Checklist item not found");

    return this.prisma.checklistItem.update({
      where: { id },
      data: {
        auditPhaseId: dto.auditPhaseId ?? undefined,
        code: dto.code === undefined ? undefined : dto.code,
        description: dto.description ?? undefined,
        weight: dto.weight ?? undefined,
        maxPoints: dto.maxPoints ?? undefined,
        active: dto.active ?? undefined,
      },
    });
  }
}

