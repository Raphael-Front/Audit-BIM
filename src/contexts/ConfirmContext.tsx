"use client";
import { createContext, useCallback, useContext, useState } from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        ...options,
        confirmLabel: options.confirmLabel ?? "Confirmar",
        cancelLabel: options.cancelLabel ?? "Cancelar",
        variant: options.variant ?? "default",
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {state.title}
            </h2>
            <p id="confirm-message" className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
              {state.message}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={
                  state.variant === "danger"
                    ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    : "rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-[hsl(var(--accent-foreground))] hover:opacity-90"
                }
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm deve ser usado dentro de ConfirmProvider");
  return confirm;
}
