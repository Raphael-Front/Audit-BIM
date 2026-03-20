"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ConfirmProvider } from "@/contexts/ConfirmContext";
import { AuthProvider } from "@/contexts/AuthContext";

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message.startsWith("TIMEOUT:")) return true;
  if (error.name === "AbortError") return true;
  if (error.name === "TimeoutError") return true;
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed")
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: (failureCount, error) => {
        if (isTimeoutError(error) || isNetworkError(error)) return failureCount < 1;
        return false;
      },
      retryDelay: 2000,
    },
    mutations: {
      retry: false,
    },
  },
});

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.action.error;
    if (isTimeoutError(error)) {
      toast.error("Tempo esgotado", {
        description: "A operação demorou mais de 10 segundos. Verifique sua conexão e tente novamente.",
        duration: 8000,
        id: "timeout-error",
      });
    } else if (isNetworkError(error)) {
      toast.error("Sem conexão", {
        description: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
        duration: 8000,
        id: "network-error",
      });
    }
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.mutation?.state.status === "error") {
    const error = event.mutation.state.error;
    if (isTimeoutError(error)) {
      toast.error("Tempo esgotado", {
        description: "A operação demorou mais de 10 segundos. Verifique sua conexão e tente novamente.",
        duration: 8000,
        id: "timeout-error",
      });
    } else if (isNetworkError(error)) {
      toast.error("Sem conexão", {
        description: "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.",
        duration: 8000,
        id: "network-error",
      });
    }
  }
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" closeButton />
          </AuthProvider>
        </QueryClientProvider>
      </ConfirmProvider>
    </ThemeProvider>
  );
}
