-- Align PRD/Schema: AuditPhase, Report, AuditCustomItem, WAITING_FOR_ISSUES, checklist by phase, cancel, revisions.

-- Enums
ALTER TYPE "AuditStatus" ADD VALUE 'WAITING_FOR_ISSUES';
CREATE TYPE "AuditKind" AS ENUM ('INITIAL', 'REVIEW');
CREATE TYPE "ReportKind" AS ENUM ('PARTIAL', 'TECHNICAL', 'FINAL');
ALTER TYPE "AuditItemStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "AuditItemStatus" ADD VALUE 'ALWAYS_CONFORMING';

-- AuditPhase
CREATE TABLE "AuditPhase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditPhase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditPhase_name_key" ON "AuditPhase"("name");
INSERT INTO "AuditPhase" ("id", "name", "label", "order", "active", "createdAt", "updatedAt")
SELECT 'cldefaultphase000000000001', 'PL', 'Planejamento', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "AuditPhase" LIMIT 1);

-- Report
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileUrl" TEXT,
    "fileType" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_auditId_idx" ON "Report"("auditId");
CREATE INDEX "Report_kind_idx" ON "Report"("kind");
CREATE INDEX "Report_generatedAt_idx" ON "Report"("generatedAt");

-- AuditCustomItem
CREATE TABLE "AuditCustomItem" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "weight" INTEGER,
    "maxPoints" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditCustomItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditCustomItem_auditId_idx" ON "AuditCustomItem"("auditId");
CREATE INDEX "AuditCustomItem_disciplineId_idx" ON "AuditCustomItem"("disciplineId");
CREATE INDEX "AuditCustomItem_categoryId_idx" ON "AuditCustomItem"("categoryId");
CREATE INDEX "AuditCustomItem_createdById_idx" ON "AuditCustomItem"("createdById");

-- ChecklistItem: add auditPhaseId (required)
ALTER TABLE "ChecklistItem" ADD COLUMN "auditPhaseId" TEXT;
UPDATE "ChecklistItem" SET "auditPhaseId" = (SELECT "id" FROM "AuditPhase" LIMIT 1);
ALTER TABLE "ChecklistItem" ALTER COLUMN "auditPhaseId" SET NOT NULL;
DROP INDEX IF EXISTS "ChecklistItem_categoryId_code_key";
CREATE UNIQUE INDEX "ChecklistItem_auditPhaseId_categoryId_code_key" ON "ChecklistItem"("auditPhaseId", "categoryId", "code");
CREATE INDEX "ChecklistItem_auditPhaseId_idx" ON "ChecklistItem"("auditPhaseId");
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_auditPhaseId_fkey" FOREIGN KEY ("auditPhaseId") REFERENCES "AuditPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Default Discipline if none
INSERT INTO "Discipline" ("id", "name", "order", "active", "createdAt", "updatedAt")
SELECT 'cldiscipline_default_001', 'GERAL', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Discipline" LIMIT 1);

-- Audit: add disciplineId, auditPhaseId, planned dates, kind, parent, revision, cancel
ALTER TABLE "Audit" ADD COLUMN "disciplineId" TEXT;
ALTER TABLE "Audit" ADD COLUMN "auditPhaseId" TEXT;
UPDATE "Audit" SET "disciplineId" = (SELECT "id" FROM "Discipline" LIMIT 1), "auditPhaseId" = (SELECT "id" FROM "AuditPhase" LIMIT 1);
ALTER TABLE "Audit" ALTER COLUMN "disciplineId" SET NOT NULL;
ALTER TABLE "Audit" ALTER COLUMN "auditPhaseId" SET NOT NULL;

ALTER TABLE "Audit" ADD COLUMN "plannedStartDate" TIMESTAMP(3);
ALTER TABLE "Audit" ADD COLUMN "plannedEndDate" TIMESTAMP(3);
ALTER TABLE "Audit" ADD COLUMN "kind" "AuditKind" NOT NULL DEFAULT 'INITIAL';
ALTER TABLE "Audit" ADD COLUMN "parentAuditId" TEXT;
ALTER TABLE "Audit" ADD COLUMN "revisionNumber" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Audit" ADD COLUMN "canceledAt" TIMESTAMP(3);
ALTER TABLE "Audit" ADD COLUMN "canceledById" TEXT;
ALTER TABLE "Audit" ADD COLUMN "cancelReason" TEXT;

CREATE INDEX "Audit_disciplineId_idx" ON "Audit"("disciplineId");
CREATE INDEX "Audit_auditPhaseId_idx" ON "Audit"("auditPhaseId");
CREATE INDEX "Audit_canceledById_idx" ON "Audit"("canceledById");
CREATE INDEX "Audit_workId_phaseId_disciplineId_auditPhaseId_idx" ON "Audit"("workId", "phaseId", "disciplineId", "auditPhaseId");

ALTER TABLE "Audit" ADD CONSTRAINT "Audit_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_auditPhaseId_fkey" FOREIGN KEY ("auditPhaseId") REFERENCES "AuditPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_parentAuditId_fkey" FOREIGN KEY ("parentAuditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_canceledById_fkey" FOREIGN KEY ("canceledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Report FK
ALTER TABLE "Report" ADD CONSTRAINT "Report_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AuditCustomItem FKs
ALTER TABLE "AuditCustomItem" ADD CONSTRAINT "AuditCustomItem_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditCustomItem" ADD CONSTRAINT "AuditCustomItem_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditCustomItem" ADD CONSTRAINT "AuditCustomItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditCustomItem" ADD CONSTRAINT "AuditCustomItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AuditItem: customItemId, previousAuditItemId, erroPosterior; checklistItemId nullable; drop template columns
ALTER TABLE "AuditItem" ADD COLUMN "customItemId" TEXT;
ALTER TABLE "AuditItem" ADD COLUMN "previousAuditItemId" TEXT;
ALTER TABLE "AuditItem" ADD COLUMN "erroPosterior" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AuditItem" ALTER COLUMN "checklistItemId" DROP NOT NULL;

ALTER TABLE "AuditItem" DROP COLUMN IF EXISTS "templateDiscipline";
ALTER TABLE "AuditItem" DROP COLUMN IF EXISTS "templateCategory";
ALTER TABLE "AuditItem" DROP COLUMN IF EXISTS "templateCode";
ALTER TABLE "AuditItem" DROP COLUMN IF EXISTS "templateDescription";
ALTER TABLE "AuditItem" DROP COLUMN IF EXISTS "templateWeight";
ALTER TABLE "AuditItem" DROP COLUMN IF EXISTS "templateMaxPoints";

CREATE INDEX "AuditItem_customItemId_idx" ON "AuditItem"("customItemId");
CREATE INDEX "AuditItem_erroPosterior_idx" ON "AuditItem"("erroPosterior");

ALTER TABLE "AuditItem" ADD CONSTRAINT "AuditItem_customItemId_fkey" FOREIGN KEY ("customItemId") REFERENCES "AuditCustomItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditItem" ADD CONSTRAINT "AuditItem_previousAuditItemId_fkey" FOREIGN KEY ("previousAuditItemId") REFERENCES "AuditItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
