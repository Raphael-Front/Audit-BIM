"use client";

import { buildConstruflowIssueUrl } from "@/lib/api";

type Props = {
  /** Código legível do apontamento, exibido ao usuário (ex.: "6796") */
  code?: string | null;
  /** ID interno do apontamento no Construflow (ex.: "1620463") */
  issueId?: string | null;
  /** ID do projeto no Construflow, vindo da obra (ex.: "1668") */
  projectId?: string | null;
  className?: string;
};

/**
 * Exibe o código do apontamento no Construflow. Quando há issueId e projectId,
 * vira um link que abre o apontamento direto na plataforma; caso contrário,
 * mostra apenas o código como texto (comportamento anterior).
 */
export function ConstruflowLink({ code, issueId, projectId, className }: Props) {
  const label = (code ?? "").trim() || (issueId ?? "").trim();
  if (!label) return null;

  const url = buildConstruflowIssueUrl(projectId, issueId);
  if (!url) return <span className={className}>{label}</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir apontamento no Construflow"
      className={`inline-flex items-center gap-1 font-medium text-[var(--color-accent)] underline decoration-[var(--color-accent)]/40 underline-offset-2 hover:decoration-[var(--color-accent)] ${className ?? ""}`}
    >
      {label}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  );
}
