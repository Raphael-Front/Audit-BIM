-- AlterTable
ALTER TABLE "AuditItem" ADD COLUMN     "templateCategory" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "templateCode" TEXT,
ADD COLUMN     "templateDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "templateDiscipline" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "templateMaxPoints" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "templateWeight" INTEGER NOT NULL DEFAULT 1;
