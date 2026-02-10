import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditItemStatus, AuditStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AddCustomItemDto } from "./dto/add-custom-item.dto";
import { CreateAuditDto } from "./dto/create-audit.dto";
import { UpdateAuditItemDto } from "./dto/update-audit-item.dto";

const OBSERVATION_PERCENT_DEFAULT = 50;

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    workId?: string;
    phaseId?: string;
    status?: AuditStatus;
    auditorId?: string;
  }) {
    return this.prisma.audit.findMany({
      where: {
        workId: params.workId,
        phaseId: params.phaseId,
        status: params.status,
        auditorId: params.auditorId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        work: true,
        phase: true,
        discipline: true,
        auditPhase: true,
        auditor: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async getById(id: string) {
    const audit = await this.prisma.audit.findUnique({
      where: { id },
      include: {
        work: true,
        phase: true,
        discipline: true,
        auditPhase: true,
        auditor: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!audit) throw new NotFoundException("Audit not found");
    return audit;
  }

  async getItems(auditId: string) {
    const audit = await this.prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException("Audit not found");

    const items = await this.prisma.auditItem.findMany({
      where: { auditId },
      orderBy: [{ createdAt: "asc" }],
      include: {
        checklistItem: {
          include: { category: { include: { discipline: true } }, auditPhase: true },
        },
        customItem: {
          include: { discipline: true, category: true },
        },
        attachments: true,
      },
    });
    return items;
  }

  async create(dto: CreateAuditDto, createdById: string) {
    const [work, phase, discipline, auditPhase, auditor] = await Promise.all([
      this.prisma.work.findUnique({ where: { id: dto.workId } }),
      this.prisma.phase.findUnique({ where: { id: dto.phaseId } }),
      this.prisma.discipline.findUnique({ where: { id: dto.disciplineId } }),
      this.prisma.auditPhase.findUnique({ where: { id: dto.auditPhaseId } }),
      this.prisma.user.findUnique({ where: { id: dto.auditorId } }),
    ]);
    if (!work) throw new NotFoundException("Work not found");
    if (!phase) throw new NotFoundException("Phase not found");
    if (!discipline) throw new NotFoundException("Discipline not found");
    if (!auditPhase) throw new NotFoundException("Audit phase not found");
    if (!auditor || !auditor.active) throw new NotFoundException("Auditor not found");

    const templateItems = await this.prisma.checklistItem.findMany({
      where: { active: true, auditPhaseId: dto.auditPhaseId },
      include: {
        category: { include: { discipline: true } },
      },
      orderBy: [{ createdAt: "asc" }],
    });
    if (templateItems.length === 0) throw new BadRequestException("No active checklist items for this audit phase");

    const kind = dto.kind ?? "INITIAL";
    const revisionNumber = dto.parentAuditId ? 1 : 0;

    return this.prisma.$transaction(async (tx) => {
      const audit = await tx.audit.create({
        data: {
          workId: dto.workId,
          phaseId: dto.phaseId,
          disciplineId: dto.disciplineId,
          auditPhaseId: dto.auditPhaseId,
          title: dto.title,
          startDate: new Date(dto.startDate),
          status: AuditStatus.IN_PROGRESS,
          plannedStartDate: dto.plannedStartDate ? new Date(dto.plannedStartDate) : null,
          plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : null,
          kind,
          parentAuditId: dto.parentAuditId ?? null,
          revisionNumber,
          createdById,
          auditorId: dto.auditorId,
        },
      });

      await tx.auditItem.createMany({
        data: templateItems.map((it) => ({
          auditId: audit.id,
          checklistItemId: it.id,
        })),
      });

      await tx.auditLog.create({
        data: {
          userId: createdById,
          auditId: audit.id,
          action: "CREATE_AUDIT",
          after: audit as unknown as object,
        },
      });

      return audit;
    });
  }

  async finishVerification(auditId: string, userId: string) {
    const audit = await this.prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException("Audit not found");
    if (audit.status !== AuditStatus.IN_PROGRESS) {
      throw new BadRequestException("Audit must be IN_PROGRESS to finish verification");
    }

    const items = await this.prisma.auditItem.findMany({
      where: { auditId },
      select: { status: true },
    });
    const notStarted = items.filter((it) => it.status === AuditItemStatus.NOT_STARTED);
    if (notStarted.length > 0) {
      throw new BadRequestException("All items must be evaluated (no NOT_STARTED) before finishing verification");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.WAITING_FOR_ISSUES },
      });
      await tx.auditLog.create({
        data: {
          userId,
          auditId,
          action: "FINALIZE_EXECUTION",
          before: { status: audit.status },
          after: { status: updated.status },
        },
      });
      return updated;
    });
  }

  async completeAudit(auditId: string, userId: string) {
    const audit = await this.prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException("Audit not found");
    if (audit.status !== AuditStatus.WAITING_FOR_ISSUES) {
      throw new BadRequestException("Audit must be WAITING_FOR_ISSUES to complete");
    }

    const ncWithoutConstruflow = await this.prisma.auditItem.findFirst({
      where: {
        auditId,
        status: AuditItemStatus.NONCONFORMING,
        OR: [{ construflowRef: null }, { construflowRef: "" }],
      },
    });
    if (ncWithoutConstruflow) {
      throw new BadRequestException("All NONCONFORMING items must have Construflow reference before completing");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.COMPLETED, endDate: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId,
          auditId,
          action: "COMPLETE_AUDIT",
          before: { status: audit.status },
          after: { status: updated.status },
        },
      });
      return updated;
    });
  }

  async cancelAudit(auditId: string, userId: string, reason?: string | null) {
    const audit = await this.prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException("Audit not found");
    if (audit.status === AuditStatus.CANCELED) {
      throw new BadRequestException("Audit is already canceled");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.audit.update({
        where: { id: auditId },
        data: {
          status: AuditStatus.CANCELED,
          canceledAt: new Date(),
          canceledById: userId,
          cancelReason: reason ?? null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          auditId,
          action: "CANCEL_AUDIT",
          before: { status: audit.status },
          after: { status: updated.status, cancelReason: reason },
        },
      });
      return updated;
    });
  }

  async addCustomItem(auditId: string, dto: AddCustomItemDto, userId: string) {
    const audit = await this.prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException("Audit not found");
    if (audit.status !== AuditStatus.IN_PROGRESS && audit.status !== AuditStatus.WAITING_FOR_ISSUES) {
      throw new BadRequestException("Custom items can only be added when audit is IN_PROGRESS or WAITING_FOR_ISSUES");
    }

    const discipline = await this.prisma.discipline.findUnique({ where: { id: dto.disciplineId } });
    if (!discipline) throw new NotFoundException("Discipline not found");
    if (dto.categoryId) {
      const cat = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!cat || cat.disciplineId !== dto.disciplineId) throw new NotFoundException("Category not found or does not belong to discipline");
    }

    return this.prisma.$transaction(async (tx) => {
      const custom = await tx.auditCustomItem.create({
        data: {
          auditId,
          disciplineId: dto.disciplineId,
          categoryId: dto.categoryId ?? null,
          description: dto.description,
          weight: dto.weight ?? null,
          maxPoints: dto.maxPoints ?? null,
          createdById: userId,
        },
      });
      const item = await tx.auditItem.create({
        data: {
          auditId,
          customItemId: custom.id,
          checklistItemId: null,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          auditId,
          auditItemId: item.id,
          action: "ADD_CUSTOM_ITEM",
          after: { customItemId: custom.id, description: dto.description },
        },
      });
      return { customItem: custom, auditItem: item };
    });
  }

  async updateItem(auditId: string, itemId: string, dto: UpdateAuditItemDto, userId: string) {
    const item = await this.prisma.auditItem.findFirst({
      where: { id: itemId, auditId },
      include: { audit: true },
    });
    if (!item) throw new NotFoundException("Audit item not found");
    if (item.isLocked) throw new BadRequestException("Item is locked");

    const nextStatus = dto.status ?? item.status;
    const nextEvidenceText = dto.evidenceText === undefined ? item.evidenceText : dto.evidenceText;
    const nextNextReviewAt =
      dto.nextReviewAt === undefined
        ? item.nextReviewAt
        : dto.nextReviewAt
          ? new Date(dto.nextReviewAt)
          : null;

    // BR-01: NONCONFORMING requires evidence and next review; Construflow can be filled in stand-by (required only at completeAudit)
    if (nextStatus === AuditItemStatus.NONCONFORMING) {
      if (!nextEvidenceText || nextEvidenceText.trim().length === 0) {
        throw new BadRequestException("Evidence is required for NONCONFORMING");
      }
      if (!nextNextReviewAt) {
        throw new BadRequestException("Next review date is required for NONCONFORMING");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.auditItem.update({
        where: { id: itemId },
        data: {
          status: dto.status ?? undefined,
          severity: dto.severity === undefined ? undefined : dto.severity,
          evidenceText: dto.evidenceText === undefined ? undefined : dto.evidenceText,
          construflowRef: dto.construflowRef === undefined ? undefined : dto.construflowRef,
          nextReviewAt: dto.nextReviewAt === undefined ? undefined : dto.nextReviewAt ? new Date(dto.nextReviewAt) : null,
          pointsObtained: dto.pointsObtained === undefined ? undefined : dto.pointsObtained,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          auditId,
          auditItemId: itemId,
          action: "UPDATE_AUDIT_ITEM",
          before: item,
          after: updated,
        },
      });

      return updated;
    });
  }

  async getScores(auditId: string) {
    const audit = await this.prisma.audit.findUnique({ where: { id: auditId } });
    if (!audit) throw new NotFoundException("Audit not found");

    const items = await this.prisma.auditItem.findMany({
      where: { auditId },
      include: {
        checklistItem: {
          include: { category: { include: { discipline: true } } },
        },
        customItem: { include: { discipline: true, category: true } },
      },
    });

    const rows = items
      .filter((it) => it.status !== AuditItemStatus.NA)
      .map((it) => {
        let disciplineName: string;
        let categoryName: string;
        let weight: number;
        let maxPoints: number;

        if (it.checklistItem) {
          disciplineName = it.checklistItem.category.discipline.name;
          categoryName = it.checklistItem.category.name;
          weight = it.weightOverride ?? it.checklistItem.weight ?? 1;
          maxPoints = it.maxPointsOverride ?? it.checklistItem.maxPoints ?? 10;
        } else if (it.customItem) {
          disciplineName = it.customItem.discipline.name;
          categoryName = it.customItem.category?.name ?? "";
          weight = it.weightOverride ?? it.customItem.weight ?? 1;
          maxPoints = it.maxPointsOverride ?? it.customItem.maxPoints ?? 10;
        } else {
          disciplineName = "";
          categoryName = "";
          weight = 1;
          maxPoints = 10;
        }

        let obtained = 0;
        if (it.pointsObtained != null) {
          obtained = clampInt(it.pointsObtained, 0, maxPoints);
        } else {
          switch (it.status) {
            case AuditItemStatus.CONFORMING:
            case AuditItemStatus.ALWAYS_CONFORMING:
            case AuditItemStatus.RESOLVED:
              obtained = maxPoints;
              break;
            case AuditItemStatus.NONCONFORMING:
              obtained = 0;
              break;
            case AuditItemStatus.OBSERVATION:
              obtained = Math.round((maxPoints * OBSERVATION_PERCENT_DEFAULT) / 100);
              break;
            case AuditItemStatus.NOT_STARTED:
            default:
              obtained = 0;
          }
        }

        return {
          discipline: disciplineName,
          category: categoryName,
          weightedMax: maxPoints * weight,
          weightedObtained: obtained * weight,
        };
      });

    const totalMax = rows.reduce((acc, r) => acc + r.weightedMax, 0);
    const totalObtained = rows.reduce((acc, r) => acc + r.weightedObtained, 0);
    const overallScore = totalMax === 0 ? 0 : Math.round((totalObtained / totalMax) * 100);

    const byDiscipline = new Map<string, { max: number; obtained: number }>();
    const byCategory = new Map<string, { max: number; obtained: number }>();

    for (const r of rows) {
      const d = byDiscipline.get(r.discipline) ?? { max: 0, obtained: 0 };
      d.max += r.weightedMax;
      d.obtained += r.weightedObtained;
      byDiscipline.set(r.discipline, d);

      const key = `${r.discipline}::${r.category}`;
      const c = byCategory.get(key) ?? { max: 0, obtained: 0 };
      c.max += r.weightedMax;
      c.obtained += r.weightedObtained;
      byCategory.set(key, c);
    }

    return {
      overall: {
        score: overallScore,
        totalMax,
        totalObtained,
      },
      byDiscipline: Array.from(byDiscipline.entries()).map(([discipline, v]) => ({
        discipline,
        score: v.max === 0 ? 0 : Math.round((v.obtained / v.max) * 100),
        totalMax: v.max,
        totalObtained: v.obtained,
      })),
      byCategory: Array.from(byCategory.entries()).map(([key, v]) => {
        const [discipline, category] = key.split("::");
        return {
          discipline,
          category,
          score: v.max === 0 ? 0 : Math.round((v.obtained / v.max) * 100),
          totalMax: v.max,
          totalObtained: v.obtained,
        };
      }),
    };
  }
}
