"use client";

import { useRouter, usePathname } from "next/navigation";
import { useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { logActivityAsync, getPermissionsConfig, type ScreenId } from "@/lib/api";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requiredPermission?: ScreenId;
  fallbackTo?: string;
};

export function ProtectedRoute({ children, requiredPermission, fallbackTo = "/auditorias" }: ProtectedRouteProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, me } = useAuth();
  const accessDeniedLogged = useRef(false);

  let redirectTo: string | null = null;
  if (status === "unauthenticated") redirectTo = "/login";
  else if (status === "authenticated" && requiredPermission && me) {
    const config = getPermissionsConfig();
    const role = me.role as keyof typeof config;
    const perms = config[role]?.permissions ?? [];
    if (!perms.includes(requiredPermission)) {
      if (!accessDeniedLogged.current) {
        accessDeniedLogged.current = true;
        logActivityAsync({
          userId: me.id,
          userName: me.name,
          userEmail: me.email,
          userRole: me.role,
          action: "ACCESS_DENIED",
          entity: "CONFIGURACAO",
          details: `Tentativa de acessar rota sem permissão: ${requiredPermission}`,
          metadata: { path: pathname },
        });
      }
      redirectTo = fallbackTo;
    }
  }

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [router, redirectTo]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Carregando…</p>
      </div>
    );
  }

  if (redirectTo) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Redirecionando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
