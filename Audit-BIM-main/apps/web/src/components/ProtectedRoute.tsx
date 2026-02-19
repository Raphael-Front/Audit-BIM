import { Navigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [auth, setAuth] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuth(session ? "authenticated" : "unauthenticated");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? "authenticated" : "unauthenticated");
    });
    return () => subscription.unsubscribe();
  }, []);

  if (auth === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-purple-600/90">Carregando…</p>
      </div>
    );
  }
  if (auth === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
