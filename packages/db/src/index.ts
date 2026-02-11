import {
  PrismaClient,
  PerfilUsuario,
  OrigemTemplate,
  StatusAuditoria,
  TipoItemAuditoria,
  StatusItemAuditoria,
  AcaoHistorico,
  TipoRelatorio,
  FormatoRelatorio,
} from "@prisma/client";

let prisma: PrismaClient | undefined;

export function getPrismaClient() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

export {
  PrismaClient,
  PerfilUsuario,
  OrigemTemplate,
  StatusAuditoria,
  TipoItemAuditoria,
  StatusItemAuditoria,
  AcaoHistorico,
  TipoRelatorio,
  FormatoRelatorio,
};

