"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTokenFromCookie, setToken } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase/client";

/**
 * Usada após confirmação de email (signUp) e possivelmente OAuth.
 * Com detectSessionInUrl, o Supabase processa o hash da URL; aqui setamos o token e redirecionamos.
 */
export function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "no-session">("loading");

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token);
        setStatus("ok");
      } else {
        setStatus("no-session");
      }
    });
  }, []);

  useEffect(() => {
    if (status === "ok") {
      router.replace("/dashboard");
      return;
    }
    if (status === "no-session") {
      router.replace("/login");
      return;
    }
    // Enquanto carrega, se já tiver token no cookie (ex.: volta do OAuth), redireciona
    const token = getTokenFromCookie();
    if (token) {
      router.replace("/dashboard");
    }
  }, [status, router]);

  if (status === "ok" || status === "no-session") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Confirmando…</p>
    </div>
  );
}
