/**
 * Serviço centralizado de Log de Atividades (Activity Log)
 */
import { createSupabaseClient } from "./supabase/client";

export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT"
  | "ACCESS_DENIED";

export type ActivityEntity =
  | "AUDITORIA"
  | "OBRA"
  | "RELATORIO"
  | "USUARIO"
  | "BIBLIOTECA"
  | "CONFIGURACAO";

export type LogActivityParams = {
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  action: ActivityAction;
  entity: ActivityEntity;
  entityId?: string | null;
  entityName?: string | null;
  details: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

function getClientInfo(): { ip: string | null; userAgent: string | null } {
  if (typeof navigator === "undefined") return { ip: null, userAgent: null };
  return {
    ip: null,
    userAgent: navigator.userAgent || null,
  };
}

async function resolveDimUsuarioId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("dim_usuarios")
      .select("id")
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const { ip, userAgent } = getClientInfo();
  const resolvedUserId = await resolveDimUsuarioId(params.userId);

  const payload = {
    user_id: resolvedUserId,
    user_name: params.userName,
    user_email: params.userEmail ?? null,
    user_role: params.userRole ?? null,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId ?? null,
    entity_name: params.entityName ?? null,
    details: params.details,
    previous_value: params.previousValue ?? null,
    new_value: params.newValue ?? null,
    ip,
    user_agent: userAgent,
  };

  try {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from("tbl_activity_logs").insert(payload);
    if (error) {
      console.warn("[ActivityLog] Erro ao inserir log:", error.message);
    }
  } catch (err) {
    console.warn("[ActivityLog] Erro ao registrar atividade:", err);
  }
}

export function logActivityAsync(params: LogActivityParams): void {
  logActivity(params).catch(() => {});
}
