import { useState } from "react";
import { auditEvidenceSignedUrl } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/contexts/ConfirmContext";

type Props = {
  anexo: { id: string; arquivoNome: string; arquivoUrl: string };
  onDelete?: () => void;
};

export function EvidenciaLink({ anexo, onDelete }: Props) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = await auditEvidenceSignedUrl(anexo.arquivoUrl);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao abrir arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    setDownloading(true);
    try {
      const url = await auditEvidenceSignedUrl(anexo.arquivoUrl);
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("Falha ao buscar arquivo");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = anexo.arquivoNome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao baixar arquivo.");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onDelete) return;
    const ok = await confirm({
      title: "Excluir arquivo",
      message: `Excluir "${anexo.arquivoNome}"?`,
      confirmLabel: "Excluir",
      variant: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir arquivo.");
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
        {loading ? "Abrindo…" : "📷 " + anexo.arquivoNome + " (abrir)"}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        title="Baixar arquivo"
        className="text-sm text-[hsl(var(--accent))] hover:underline disabled:opacity-50"
      >
        {downloading ? "Baixando…" : "Baixar"}
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
