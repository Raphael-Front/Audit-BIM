import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { Container } from "@/components/layout/Container";

import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ObrasPage } from "@/pages/ObrasPage";
import { ObraNewPage } from "@/pages/ObraNewPage";
import { ObraDetailPage } from "@/pages/ObraDetailPage";
import { AuditoriasPage } from "@/pages/AuditoriasPage";
import { AuditoriaNewPage } from "@/pages/AuditoriaNewPage";
import { AuditoriaDetailPage } from "@/pages/AuditoriaDetailPage";
import { ExecucaoPage } from "@/pages/ExecucaoPage";
import { NCsPage } from "@/pages/NCsPage";
import { RelatoriosListPage } from "@/pages/RelatoriosListPage";
import { RelatoriosPage } from "@/pages/RelatoriosPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { TemplateNewPage } from "@/pages/TemplateNewPage";
import { TemplateDetailPage } from "@/pages/TemplateDetailPage";
import { CategoryNewPage } from "@/pages/CategoryNewPage";
import { LibraryManagePage } from "@/pages/LibraryManagePage";
import { AuditsPage } from "@/pages/AuditsPage";
import { AuditDetailPage } from "@/pages/AuditDetailPage";
import { ConfiguracoesPage } from "@/pages/ConfiguracoesPage";
import { PerfilPage } from "@/pages/PerfilPage";

function HomeRedirect() {
  const [dest, setDest] = useState<"/dashboard" | "/login" | null>(null);
  useEffect(() => {
    import("@/lib/supabase/client").then(({ createSupabaseClient }) => {
      createSupabaseClient().auth.getSession().then(({ data }) => {
        setDest(data.session ? "/dashboard" : "/login");
      });
    });
  }, []);
  if (dest === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-purple-600/90">Carregando…</p>
      </div>
    );
  }
  return <Navigate to={dest} replace />;
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/obras"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ObrasPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/obras/new"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ObraNewPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/obras/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ObraDetailPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditorias"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <AuditoriasPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditorias/new"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <AuditoriaNewPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditorias/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <AuditoriaDetailPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditorias/:id/execucao"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ExecucaoPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditorias/:id/ncs"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <NCsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatorios"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <RelatoriosListPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ConfiguracoesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PerfilPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/auditorias/:id/relatorios"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <RelatoriosPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <TemplatesPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates/new"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <TemplateNewPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <TemplateDetailPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories/new"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <CategoryNewPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/library/manage"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <LibraryManagePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audits"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Container>
                <AuditsPage />
              </Container>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audits/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Container>
                <AuditDetailPage />
              </Container>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
