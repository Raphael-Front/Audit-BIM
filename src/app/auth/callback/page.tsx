"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTokenFromCookie, setToken, authMe, prepopulateMeCache } from "@/lib/api";
import { createSupabaseClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ok" | "no-session">("loading");

  useEffect(() => {
    const token = getTokenFromCookie();
    if (token) {
      router.replace("/dashboard");
      return;
    }
    const supabase = createSupabaseClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token);
        try {
          const me = await authMe();
          prepopulateMeCache(session.user.id, me);
        } catch { /* cache opcional; AuthContext vai buscar */ }
        setStatus("ok");
      } else {
        setStatus("no-session");
      }
    });
  }, [router]);

  useEffect(() => {
    if (status === "ok") router.replace("/dashboard");
    if (status === "no-session") router.replace("/login");
  }, [status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">Confirmando…</p>
    </div>
  );
}
