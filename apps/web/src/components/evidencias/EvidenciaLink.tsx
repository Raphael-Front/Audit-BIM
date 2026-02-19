import { useState } from "react";
import { auditEvidenceSignedUrl } from "@/lib/api";

type Props = {
  anexo: { id: string; arquivoNome: string; arquivoUrl: string };
  onDelete?: () => void;
};

export function EvidenciaLink({ anexo, onDelete }: Props) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = await auditEvidenceSignedUrl(anexo.arquivoUrl);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      console.error(err);
      alert("Erro ao abrir arquivo.");
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onDelete) return;
    if (!window.confirm(`Excluir "${anexo.arquivoNome}"?`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir arquivo.");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm text-[hsl(var(--accent))] hover:underline disabled:opacity-50"
      >
        {loading ? "Abrindo…" : "📷 " + anexo.arquivoNome + " (abrir/baixar)"}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          title="Excluir anexo"
          className="text-red-600 hover:text-red-700 hover:underline text-xs disabled:opacity-50"
        >
          {deleting ? "Excluindo…" : "Excluir"}
        </button>
      )}
    </span>
  );
}
