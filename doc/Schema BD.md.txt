// prisma/schema.prisma
// BIM Audit Web — Prisma ORM schema (PostgreSQL)
// AJUSTADO conforme PRD atualizado:
// - Relatórios exibem auditorias IN_PROGRESS, WAITING_FOR_ISSUES e COMPLETED (parcial/técnico/final)
// - Revisões: auditorias podem ter "base" (primeira) e revisões encadeadas
// - Itens em revisão: status inclui resolvido/sempre conforme/não conforme
// - “Erro posterior”: flag quando item resolvido volta a ficar não conforme
// - Checklist por fase: itens podem ser aplicáveis por fase (PL/LO etc.), e podem variar por fase
// - Auditoria NÃO é excluída (pode ser CANCELED; opcional: campos de cancelamento)
// - Permite adicionar itens personalizados na auditoria (AuditCustomItem) sem alterar biblioteca
// - Stand-by: após avaliar tudo, auditoria vai para WAITING_FOR_ISSUES para vincular códigos Construflow

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/* -----------------------------
   ENUMS
------------------------------ */

enum UserRole {
  ADMIN
  AUDITOR
  READER
}

enum AuditStatus {
  IN_PROGRESS
  WAITING_FOR_ISSUES // Stand-by: aguardando abertura/vínculo de apontamentos no Construflow
  COMPLETED
  CANCELED
}

enum AuditKind {
  INITIAL   // primeira auditoria da disciplina/fase
  REVIEW    // revisão de auditoria anterior
}

enum ReportKind {
  PARTIAL   // auditoria em andamento
  TECHNICAL // auditoria em stand-by (itens avaliados, faltam códigos Construflow)
  FINAL     // auditoria concluída
}

enum AuditItemStatus {
  // Status padrão (para INITIAL e também pode existir em REVIEW)
  NOT_STARTED
  CONFORMING
  NONCONFORMING
  OBSERVATION
  NA

  // Status específicos de revisão (ênfase nos cards conforme status)
  RESOLVED          // estava NC e agora foi resolvido
  ALWAYS_CONFORMING // historicamente sempre conforme
}

enum AuditItemSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

/* -----------------------------
   CORE: USERS / AUTH
------------------------------ */

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String   // hash (bcrypt/argon2)
  role      UserRole @default(AUDITOR)
  active    Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  auditsCreated Audit[]    @relation("AuditCreatedBy")
  logs          AuditLog[] @relation("LogByUser")

  // para itens personalizados
  customItemsCreated AuditCustomItem[]
}

/* -----------------------------
   MASTER DATA: WORKS / PHASES
   (Phase aqui é fase do empreendimento por obra.
    Para "fase da auditoria" (PL/LO/Projeto Executivo etc.) usamos AuditPhase)
------------------------------ */

model Work {
  id        String   @id @default(cuid())
  name      String
  code      String?  @unique
  active    Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  phases Phase[]
  audits  Audit[]
}

model Phase {
  id        String   @id @default(cuid())
  workId    String
  name      String
  order     Int      @default(0)
  active    Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  work   Work   @relation(fields: [workId], references: [id], onDelete: Cascade)
  audits Audit[]

  @@unique([workId, name])
  @@index([workId])
}

/* -----------------------------
   AUDIT PHASES (PL, LO, PE etc.)
   Fases "da auditoria" usadas para variar checklist e aparecer nos cards.
------------------------------ */

model AuditPhase {
  id        String   @id @default(cuid())
  name      String   @unique // ex: "PL", "EP", "PROJETO_EXECUTIVO", "LO"
  label     String           // ex: "Planejamento", "Projeto Executivo", etc.
  order     Int      @default(0)
  active    Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  checklistItems ChecklistItem[]
  audits         Audit[]
}

/* -----------------------------
   LIBRARY: DISCIPLINES / CATEGORIES / CHECKLIST TEMPLATE
------------------------------ */

model Discipline {
  id        String   @id @default(cuid())
  name      String   @unique // "ARQ", "STR", "HID"...
  order     Int      @default(0)
  active    Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  categories Category[]
  audits      Audit[]
}

model Category {
  id           String   @id @default(cuid())
  disciplineId String
  name         String
  order        Int      @default(0)
  active       Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  discipline     Discipline      @relation(fields: [disciplineId], references: [id], onDelete: Restrict)
  checklistItems ChecklistItem[]

  @@unique([disciplineId, name])
  @@index([disciplineId])
}

model ChecklistItem {
  id           String  @id @default(cuid())
  categoryId   String
  auditPhaseId String // aplica por fase da auditoria (PL/LO etc.)

  code        String? // opcional: "ARQ-MOD-001"
  description String

  // pontuação/peso default (pode ser sobrescrito na auditoria)
  weight      Int     @default(1)
  maxPoints   Int     @default(10)

  active      Boolean @default(true)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  category   Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  auditPhase AuditPhase @relation(fields: [auditPhaseId], references: [id], onDelete: Restrict)

  auditItems AuditItem[]

  @@unique([auditPhaseId, categoryId, code])
  @@index([categoryId])
  @@index([auditPhaseId])
}

/* -----------------------------
   AUDITS: HEADER + ITEMS (instância do template)
   Ajustes:
   - disciplina no cabeçalho (PRD: auditoria por disciplina)
   - auditPhase no cabeçalho (PRD: cards por fase e checklist variável)
   - revisões encadeadas (kind + parentAuditId + revisionNumber)
   - relatório parcial/técnico/final (modelado em Report; kind pode ser derivado do status)
   - stand-by: WAITING_FOR_ISSUES (itens avaliados, faltam códigos Construflow)
   - auditoria não excluível (usa CANCELED + campos opcionais)
------------------------------ */

model Audit {
  id            String      @id @default(cuid())

  workId        String
  phaseId       String        // fase do empreendimento (por obra)
  disciplineId  String        // disciplina auditada (ARQ/STR/etc.)
  auditPhaseId  String        // fase da auditoria (PL/LO/PE etc.)

  title         String
  startDate     DateTime
  endDate       DateTime?
  status        AuditStatus   @default(IN_PROGRESS)

  // opcional: datas planejadas (cronograma)
  plannedStartDate DateTime?
  plannedEndDate   DateTime?

  kind           AuditKind     @default(INITIAL)
  parentAuditId  String?       // aponta para auditoria anterior, se for REVIEW
  revisionNumber Int           @default(0) // 0 = inicial; 1..n revisões

  createdById   String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // cancelamento (sem excluir)
  canceledAt     DateTime?
  canceledById   String?
  cancelReason   String?

  work       Work       @relation(fields: [workId], references: [id], onDelete: Restrict)
  phase      Phase      @relation(fields: [phaseId], references: [id], onDelete: Restrict)
  discipline Discipline @relation(fields: [disciplineId], references: [id], onDelete: Restrict)
  auditPhase AuditPhase @relation(fields: [auditPhaseId], references: [id], onDelete: Restrict)

  createdBy  User       @relation("AuditCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  canceledBy User?      @relation("AuditCanceledBy", fields: [canceledById], references: [id], onDelete: Restrict)

  // revisões
  parentAudit Audit? @relation("AuditRevisions", fields: [parentAuditId], references: [id], onDelete: Restrict)
  revisions   Audit[] @relation("AuditRevisions")

  items    AuditItem[]
  logs     AuditLog[]
  reports  Report[]
  customItems AuditCustomItem[]

  @@index([workId])
  @@index([phaseId])
  @@index([disciplineId])
  @@index([auditPhaseId])
  @@index([status])
  @@index([createdById])
  @@index([canceledById])

  // contexto para busca rápida
  @@index([workId, phaseId, disciplineId, auditPhaseId])
}

/* -----------------------------
   ITENS PERSONALIZADOS (adicionados na auditoria)
   - não alteram a biblioteca
   - permitem corrigir "esqueci de colocar algo" durante IN_PROGRESS ou WAITING_FOR_ISSUES
------------------------------ */

model AuditCustomItem {
  id            String   @id @default(cuid())
  auditId       String
  disciplineId  String
  categoryId    String?

  description   String

  // opcional: pontuação/peso específico do item manual
  weight        Int?
  maxPoints     Int?

  createdById   String
  createdAt     DateTime @default(now())

  audit       Audit       @relation(fields: [auditId], references: [id], onDelete: Cascade)
  discipline Discipline  @relation(fields: [disciplineId], references: [id], onDelete: Restrict)
  category   Category?   @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  createdBy  User        @relation(fields: [createdById], references: [id], onDelete: Restrict)

  auditItems  AuditItem[]

  @@index([auditId])
  @@index([disciplineId])
  @@index([categoryId])
  @@index([createdById])
}

/* -----------------------------
   AUDIT ITEMS
   Ajustes:
   - aceita checklistItemId OU customItemId (itens adicionados na auditoria)
   - erroPosterior: item resolvido que volta a NC em revisão
   - previousAuditItemId: encadeia item da revisão com o item anterior (histórico)
------------------------------ */

model AuditItem {
  id                 String          @id @default(cuid())
  auditId            String

  // item pode vir do template OU ser um item adicionado na auditoria
  checklistItemId    String?
  customItemId       String?

  // para revisão: referencia o item anterior correspondente (se existir)
  previousAuditItemId String?

  status             AuditItemStatus @default(NOT_STARTED)
  severity           AuditItemSeverity?

  evidenceText       String?
  construflowRef     String? // preenchido na etapa final (stand-by) para itens NC
  nextReviewAt       DateTime?

  // revisões: indica reabertura de erro (PRD: "erro posterior")
  erroPosterior      Boolean @default(false)

  // overrides
  weightOverride     Int?
  maxPointsOverride  Int?
  pointsObtained     Int?

  // travas
  isLocked           Boolean @default(false)

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  audit         Audit          @relation(fields: [auditId], references: [id], onDelete: Cascade)
  checklistItem ChecklistItem? @relation(fields: [checklistItemId], references: [id], onDelete: Restrict)
  customItem    AuditCustomItem? @relation(fields: [customItemId], references: [id], onDelete: Cascade)

  previousAuditItem AuditItem? @relation("AuditItemHistory", fields: [previousAuditItemId], references: [id], onDelete: Restrict)
  nextAuditItems    AuditItem[] @relation("AuditItemHistory")

  attachments Attachment[]
  logs        AuditLog[]

  // OBS: Não dá pra garantir XOR (checklistItemId vs customItemId) apenas no Prisma.
  // Validar no backend: exatamente um deles deve estar preenchido.

  // Unicidade para itens do template: 1 instância por checklist item por auditoria
  @@unique([auditId, checklistItemId])
  @@index([auditId, status])
  @@index([checklistItemId])
  @@index([customItemId])
  @@index([nextReviewAt])
  @@index([erroPosterior])
}

/* -----------------------------
   REPORTS
   - PARTIAL: auditoria IN_PROGRESS
   - TECHNICAL: auditoria WAITING_FOR_ISSUES
   - FINAL: auditoria COMPLETED
------------------------------ */

model Report {
  id          String     @id @default(cuid())
  auditId     String
  kind        ReportKind
  version     Int        @default(1)

  fileUrl     String?
  fileType    String?    // "pdf" | "xlsx"
  generatedAt DateTime   @default(now())

  audit       Audit @relation(fields: [auditId], references: [id], onDelete: Cascade)

  @@index([auditId])
  @@index([kind])
  @@index([generatedAt])
}

/* -----------------------------
   FILES: EVIDÊNCIAS (anexos)
------------------------------ */

model Attachment {
  id          String   @id @default(cuid())
  auditItemId String

  name        String
  url         String
  mimeType    String?
  sizeBytes   Int?

  createdAt   DateTime @default(now())

  auditItem AuditItem @relation(fields: [auditItemId], references: [id], onDelete: Cascade)

  @@index([auditItemId])
}

/* -----------------------------
   AUDIT TRAIL: LOGS
------------------------------ */

model AuditLog {
  id          String   @id @default(cuid())

  userId      String
  auditId     String?
  auditItemId String?

  action      String   // ex: "STATUS_CHANGE", "UPDATE_EVIDENCE", "FINALIZE_EXECUTION", "ADD_CUSTOM_ITEM"
  before      Json?
  after       Json?

  createdAt   DateTime @default(now())

  user      User      @relation("LogByUser", fields: [userId], references: [id], onDelete: Restrict)
  audit     Audit?     @relation(fields: [auditId], references: [id], onDelete: Cascade)
  auditItem AuditItem? @relation(fields: [auditItemId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([auditId])
  @@index([auditItemId])
  @@index([createdAt])
}
