"use client";

import { usePathname } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";

const AUTH_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPath = AUTH_PATHS.includes(pathname ?? "/");

  if (isAuthPath) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
