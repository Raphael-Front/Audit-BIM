import { z } from "zod";
import { AuditItemSeverity, AuditItemStatus, AuditStatus, UserRole } from "./enums";

export type Id = string;

export type User = {
  id: Id;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Work = {
  id: Id;
  name: string;
  code?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Phase = {
  id: Id;
  workId: Id;
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Discipline = {
  id: Id;
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: Id;
  disciplineId: Id;
  name: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistItem = {
  id: Id;
  categoryId: Id;
  code?: string | null;
  description: string;
  weight: number;
  maxPoints: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Audit = {
  id: Id;
  workId: Id;
  phaseId: Id;
  title: string;
  startDate: string;
  endDate?: string | null;
  status: AuditStatus;
  createdById: Id;
  createdAt: string;
  updatedAt: string;
};

export type AuditItem = {
  id: Id;
  auditId: Id;
  checklistItemId: Id;
  status: AuditItemStatus;
  severity?: AuditItemSeverity | null;
  evidenceText?: string | null;
  construflowRef?: string | null;
  nextReviewAt?: string | null;
  weightOverride?: number | null;
  maxPointsOverride?: number | null;
  pointsObtained?: number | null;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  id: Id;
  auditItemId: Id;
  name: string;
  url: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

export type AuditLog = {
  id: Id;
  userId: Id;
  auditId?: Id | null;
  auditItemId?: Id | null;
  action: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

// -----------------------------
// Zod schemas (frontend forms)
// -----------------------------

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createWorkSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional().nullable(),
});

export const createPhaseSchema = z.object({
  workId: z.string().min(1),
  name: z.string().min(1),
  order: z.number().int().min(0).default(0),
});

export const createAuditSchema = z.object({
  workId: z.string().min(1),
  phaseId: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().min(1), // ISO date (yyyy-mm-dd)
  auditorId: z.string().min(1),
});

export const updateAuditItemSchema = z.object({
  status: z.nativeEnum(AuditItemStatus).optional(),
  evidenceText: z.string().optional().nullable(),
  construflowRef: z.string().optional().nullable(),
  nextReviewAt: z.string().optional().nullable(), // ISO date
  pointsObtained: z.number().int().optional().nullable(),
  severity: z.nativeEnum(AuditItemSeverity).optional().nullable(),
});

