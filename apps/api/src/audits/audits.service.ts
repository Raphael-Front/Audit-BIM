import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AcaoHistorico, StatusAuditoria, StatusItemAuditoria } from '@bim-audit/db';
import { PrismaService } from '../prisma/prisma.service';
import { AddCustomItemDto } from './dto/add-custom-item.dto';
import { CreateAuditDto } from './dto/create-audit.dto';
import { UpdateAuditItemDto } from './dto/update-audit-item.dto';

const OBSERVATION_PERCENT_DEFAULT = 50;

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function genCodigoAuditoria(): string {
  return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) {}

  private async writeHistorio(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    data: {
      tabelaNome: string;
      registroId: string;
      campoNome: string;
      valorAnterior?: string | null;
      valorNovo?: string | null;
      acao: AcaoHistorico;
      usuarioId: string;
    },
  ) {
    await tx.tblHistoricoAlteracao.create({
      data: {
        ...data,
        valorAnterior: data.valorAnterior ?? null,
        valorNovo: data.valorNovo ?? null,
      },
    });
  }

  async list(params: {
    workId?: string;
    phaseId?: string;
    status?: StatusAuditoria;
    auditorId?: string;
  }) {
    const where: {
      obraId?: string;
      faseId?: string;
      status?: StatusAuditoria;
      auditorResponsavelId?: string;
    } = {};
    if (params.workId) where.obraId = params.workId;
    if (params.phaseId) where.faseId = params.phaseId;
    if (params.status) where.status = params.status;
    if (params.auditorId) where.auditorResponsavelId = params.auditorId;

    return this.prisma.fatoAuditoria.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        obra: true,
        fase: true,
        disciplina: true,
        auditorResponsavel: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            perfil: true,
          },
        },
      },
    });
  }

  async getById(id: string) {
    const audit = await this.prisma.fatoAuditoria.findUnique({
      where: { id },
      include: {
        obra: true,
        fase: true,
        disciplina: true,
        auditorResponsavel: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            perfil: true,
          },
        },
      },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    return audit;
  }

  async getItems(auditId: string) {
    const audit = await this.prisma.fatoAuditoria.findUnique({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Audit not found');

    return this.prisma.fatoAuditoriaItem.findMany({
      where: { auditoriaId: auditId },
      orderBy: [{ ordemExibicao: 'asc' }, { createdAt: 'asc' }],
      include: {
        templateItem: {
          include: {
            categoria: true,
            aplicabilidadeFases: { include: { fase: true } },
          },
        },
        categoria: true,
        disciplina: true,
        itensPersonalizados: true,
      },
    });
  }

  async create(dto: CreateAuditDto, createdById: string) {
    const [obra, fase, discipline, auditor] = await Promise.all([
      this.prisma.dimObra.findFirst({
        where: { id: dto.workId, deletedAt: null },
      }),
      this.prisma.dimFase.findUnique({ where: { id: dto.auditPhaseId } }),
      this.prisma.dimDisciplina.findUnique({ where: { id: dto.disciplineId } }),
      this.prisma.dimUsuario.findUnique({ where: { id: dto.auditorId } }),
    ]);
    if (!obra) throw new NotFoundException('Work not found');
    if (!fase) throw new NotFoundException('Audit phase not found');
    if (!discipline) throw new NotFoundException('Discipline not found');
    if (!auditor || !auditor.ativo)
      throw new NotFoundException('Auditor not found');

    const templates = await this.prisma.tblChecklistTemplate.findMany({
      where: {
        ativo: true,
        disciplinaId: dto.disciplineId,
        aplicabilidadeFases: {
          some: { faseId: dto.auditPhaseId },
        },
      },
      include: { categoria: true },
      orderBy: [{ ordemExibicao: 'asc' }, { createdAt: 'asc' }],
    });
    if (templates.length === 0)
      throw new BadRequestException(
        'No active checklist items for this audit phase',
      );

    const codigoAuditoria = genCodigoAuditoria();
    const dataInicio = new Date(dto.startDate);
    const dataFimPrevista = dto.plannedEndDate
      ? new Date(dto.plannedEndDate)
      : null;

    return this.prisma.$transaction(async (tx) => {
      const audit = await tx.fatoAuditoria.create({
        data: {
          codigoAuditoria,
          obraId: dto.workId,
          disciplinaId: dto.disciplineId,
          faseId: dto.auditPhaseId,
          titulo: dto.title,
          dataInicio,
          dataFimPrevista,
          auditorResponsavelId: dto.auditorId,
          status: StatusAuditoria.em_andamento,
        },
      });

      await tx.fatoAuditoriaItem.createMany({
        data: templates.map((t, i) => ({
          auditoriaId: audit.id,
          templateItemId: t.id,
          categoriaId: t.categoriaId,
          disciplinaId: t.disciplinaId,
          itemVerificacaoSnapshot: t.itemVerificacao,
          pesoSnapshot: t.peso,
          pontosMaximoSnapshot: t.pontosMaximo,
          ordemExibicao: i,
        })),
      });

      await this.writeHistorio(tx, {
        tabelaNome: 'fato_auditorias',
        registroId: audit.id,
        campoNome: 'status',
        valorNovo: StatusAuditoria.em_andamento,
        acao: AcaoHistorico.INSERT,
        usuarioId: createdById,
      });

      return audit;
    });
  }

  async finishVerification(auditId: string, userId: string) {
    const audit = await this.prisma.fatoAuditoria.findUnique({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.status !== StatusAuditoria.em_andamento) {
      throw new BadRequestException(
        'Audit must be em_andamento to finish verification',
      );
    }

    const items = await this.prisma.fatoAuditoriaItem.findMany({
      where: { auditoriaId: auditId },
      select: { status: true },
    });
    const notStarted = items.filter(
      (it) => it.status === StatusItemAuditoria.nao_iniciado,
    );
    if (notStarted.length > 0) {
      throw new BadRequestException(
        'All items must be evaluated (no nao_iniciado) before finishing verification',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fatoAuditoria.update({
        where: { id: auditId },
        data: { status: StatusAuditoria.aguardando_apontamentos },
      });
      await this.writeHistorio(tx, {
        tabelaNome: 'fato_auditorias',
        registroId: auditId,
        campoNome: 'status',
        valorAnterior: audit.status,
        valorNovo: updated.status,
        acao: AcaoHistorico.FINALIZAR_VERIFICACAO,
        usuarioId: userId,
      });
      return updated;
    });
  }

  async completeAudit(auditId: string, userId: string) {
    const audit = await this.prisma.fatoAuditoria.findUnique({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.status !== StatusAuditoria.aguardando_apontamentos) {
      throw new BadRequestException(
        'Audit must be aguardando_apontamentos to complete',
      );
    }

    const ncWithoutConstruflow = await this.prisma.fatoAuditoriaItem.findFirst({
      where: {
        auditoriaId: auditId,
        status: StatusItemAuditoria.nao_conforme,
        OR: [
          { codigoConstruflow: null },
          { codigoConstruflow: '' },
        ],
      },
    });
    if (ncWithoutConstruflow) {
      throw new BadRequestException(
        'All nao_conforme items must have Construflow reference before completing',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fatoAuditoria.update({
        where: { id: auditId },
        data: {
          status: StatusAuditoria.concluida,
          dataConclusao: new Date(),
        },
      });
      await this.writeHistorio(tx, {
        tabelaNome: 'fato_auditorias',
        registroId: auditId,
        campoNome: 'status',
        valorAnterior: audit.status,
        valorNovo: updated.status,
        acao: AcaoHistorico.CONCLUIR_AUDITORIA,
        usuarioId: userId,
      });
      return updated;
    });
  }

  async cancelAudit(auditId: string, userId: string, reason?: string | null) {
    const audit = await this.prisma.fatoAuditoria.findUnique({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    if (audit.status === StatusAuditoria.cancelada) {
      throw new BadRequestException('Audit is already canceled');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fatoAuditoria.update({
        where: { id: auditId },
        data: {
          status: StatusAuditoria.cancelada,
          canceladoEm: new Date(),
          canceladoPorId: userId,
          motivoCancelamento: reason ?? null,
        },
      });
      await this.writeHistorio(tx, {
        tabelaNome: 'fato_auditorias',
        registroId: auditId,
        campoNome: 'status',
        valorAnterior: audit.status,
        valorNovo: updated.status,
        acao: AcaoHistorico.CANCELAR_AUDITORIA,
        usuarioId: userId,
      });
      return updated;
    });
  }

  async addCustomItem(auditId: string, dto: AddCustomItemDto, userId: string) {
    const audit = await this.prisma.fatoAuditoria.findUnique({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Audit not found');
    if (
      audit.status !== StatusAuditoria.em_andamento &&
      audit.status !== StatusAuditoria.aguardando_apontamentos
    ) {
      throw new BadRequestException(
        'Custom items can only be added when audit is em_andamento or aguardando_apontamentos',
      );
    }

    const discipline = await this.prisma.dimDisciplina.findUnique({
      where: { id: dto.disciplineId },
    });
    if (!discipline) throw new NotFoundException('Discipline not found');

    const categoriaId = dto.categoryId ?? null;
    if (!categoriaId)
      throw new BadRequestException('categoryId is required for custom item');
    const link = await this.prisma.dimCategoriaDisciplina.findUnique({
      where: {
        categoriaId_disciplinaId: {
          categoriaId: categoriaId,
          disciplinaId: dto.disciplineId,
        },
      },
    });
    if (!link)
      throw new NotFoundException(
        'Category not found or does not belong to discipline',
      );

    const peso = dto.weight ?? 1;
    const pontosMaximo = dto.maxPoints ?? 10;

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.fatoAuditoriaItem.create({
        data: {
          auditoriaId: auditId,
          categoriaId,
          disciplinaId: dto.disciplineId,
          itemVerificacaoSnapshot: dto.description,
          pesoSnapshot: peso,
          pontosMaximoSnapshot: pontosMaximo,
          tipoItem: 'personalizado',
        },
      });

      await tx.tblItemPersonalizadoSalvo.create({
        data: {
          auditoriaItemId: item.id,
          disciplinaId: dto.disciplineId,
          categoriaId,
          itemVerificacao: dto.description,
          peso,
          pontosMaximo,
          criadoPorId: userId,
        },
      });

      await this.writeHistorio(tx, {
        tabelaNome: 'fato_auditoria_itens',
        registroId: item.id,
        campoNome: 'tipoItem',
        valorNovo: 'personalizado',
        acao: AcaoHistorico.ADICIONAR_ITEM_PERSONALIZADO,
        usuarioId: userId,
      });

      return { auditItem: item };
    });
  }

  async updateItem(
    auditId: string,
    itemId: string,
    dto: UpdateAuditItemDto,
    userId: string,
  ) {
    const item = await this.prisma.fatoAuditoriaItem.findFirst({
      where: { id: itemId, auditoriaId: auditId },
      include: { auditoria: true },
    });
    if (!item) throw new NotFoundException('Audit item not found');

    const nextStatus = dto.status ?? item.status;
    const nextEvidenceText =
      dto.evidenceText === undefined
        ? item.evidenciaObservacao
        : dto.evidenceText;
    const nextNextReviewAt =
      dto.nextReviewAt === undefined
        ? item.proximaRevisao
        : dto.nextReviewAt
          ? new Date(dto.nextReviewAt)
          : null;

    if (nextStatus === StatusItemAuditoria.nao_conforme) {
      if (!nextEvidenceText || nextEvidenceText.trim().length === 0) {
        throw new BadRequestException(
          'Evidence is required for nao_conforme',
        );
      }
      if (!nextNextReviewAt) {
        throw new BadRequestException(
          'Next review date is required for nao_conforme',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fatoAuditoriaItem.update({
        where: { id: itemId },
        data: {
          status: dto.status ?? undefined,
          evidenciaObservacao:
            dto.evidenceText === undefined ? undefined : dto.evidenceText,
          codigoConstruflow:
            dto.construflowRef === undefined ? undefined : dto.construflowRef,
          proximaRevisao:
            dto.nextReviewAt === undefined
              ? undefined
              : dto.nextReviewAt
                ? new Date(dto.nextReviewAt)
                : null,
          pontosObtidos:
            dto.pointsObtained === undefined
              ? undefined
              : Number(dto.pointsObtained ?? 0),
          avaliadoPorId: userId,
          avaliadoEm: new Date(),
        },
      });

      await this.writeHistorio(tx, {
        tabelaNome: 'fato_auditoria_itens',
        registroId: itemId,
        campoNome: 'status',
        valorAnterior: item.status,
        valorNovo: updated.status,
        acao: AcaoHistorico.UPDATE,
        usuarioId: userId,
      });

      return updated;
    });
  }

  async getScores(auditId: string) {
    const audit = await this.prisma.fatoAuditoria.findUnique({
      where: { id: auditId },
    });
    if (!audit) throw new NotFoundException('Audit not found');

    const items = await this.prisma.fatoAuditoriaItem.findMany({
      where: { auditoriaId: auditId },
      include: {
        disciplina: true,
        templateItem: { include: { categoria: true } },
        categoria: true,
        itensPersonalizados: true,
      },
    });

    const rows = items
      .filter((it) => it.status !== StatusItemAuditoria.nao_aplicavel)
      .map((it) => {
        const disciplineName = it.disciplina?.nome ?? '';
        const categoryName = it.categoria?.nome ?? '';
        const weight = it.pesoSnapshot ?? 1;
        const maxPoints = Number(it.pontosMaximoSnapshot ?? 10);

        let obtained = 0;
        if (it.pontosObtidos != null) {
          obtained = clampInt(Number(it.pontosObtidos), 0, maxPoints);
        } else {
          switch (it.status) {
            case StatusItemAuditoria.conforme:
            case StatusItemAuditoria.corrigido:
              obtained = maxPoints;
              break;
            case StatusItemAuditoria.nao_conforme:
              obtained = 0;
              break;
            case StatusItemAuditoria.nao_iniciado:
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
    const overallScore =
      totalMax === 0 ? 0 : Math.round((totalObtained / totalMax) * 100);

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
      byDiscipline: Array.from(byDiscipline.entries()).map(
        ([discipline, v]) => ({
          discipline,
          score: v.max === 0 ? 0 : Math.round((v.obtained / v.max) * 100),
          totalMax: v.max,
          totalObtained: v.obtained,
        }),
      ),
      byCategory: Array.from(byCategory.entries()).map(([key, v]) => {
        const [discipline, category] = key.split('::');
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
