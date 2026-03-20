"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { TemplatesPage } from "@/views/TemplatesPage";

export default function Page() {
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Carregando…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Redirecionando para o login…</p>
      </div>
    );
  }

  return <TemplatesPage />;
}
