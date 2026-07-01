"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronsUpDown, Check, Search } from "lucide-react";
import { useObra } from "@/contexts/ObraContext";
import { cn } from "@/lib/utils";

export function ObraSelector() {
  const { selection, setSelection, obras, selectedObra, isAll } = useObra();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  const label = isAll ? "Todas as obras" : selectedObra?.name ?? "Selecionar obra";
  const q = query.trim().toLowerCase();
  const filtered = q
    ? obras.filter(
        (o) => o.name.toLowerCase().includes(q) || (o.code ?? "").toLowerCase().includes(q),
      )
    : obras;

  function choose(sel: ObraSelectionValue) {
    setSelection(sel);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--font-size-small)] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] max-w-[160px] sm:max-w-[240px]"
        title="Selecionar obra"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Building2 className="size-4 shrink-0 text-[var(--color-text-muted)]" />
        <span className="truncate">{label}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[280px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <Search className="size-4 shrink-0 text-[var(--color-text-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar obra…"
              className="w-full bg-transparent text-[var(--font-size-small)] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
          </div>
          <ul className="max-h-[300px] overflow-y-auto py-1" role="listbox">
            <li>
              <button
                type="button"
                onClick={() => choose("all")}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-[var(--font-size-small)] hover:bg-[var(--color-bg)]",
                  isAll && "font-medium text-[var(--color-accent)]",
                )}
              >
                Todas as obras
                {isAll && <Check className="size-4 shrink-0" />}
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => choose(o.id)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-[var(--font-size-small)] hover:bg-[var(--color-bg)]",
                    selection === o.id && "font-medium text-[var(--color-accent)]",
                  )}
                >
                  <span className="truncate">{o.name}</span>
                  {selection === o.id && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-center text-[var(--font-size-mini)] text-[var(--color-text-muted)]">
                Nenhuma obra encontrada
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

type ObraSelectionValue = "all" | string;
