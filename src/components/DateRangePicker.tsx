"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "lucide-react";
import "react-day-picker/style.css";

export type DateRangeValue = { from: string; to: string };

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className = "" }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DateRangeValue>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const fromDate = pending.from ? new Date(pending.from + "T12:00:00") : undefined;
  const toDate = pending.to ? new Date(pending.to + "T12:00:00") : undefined;

  const selected: { from?: Date; to?: Date } | undefined =
    fromDate || toDate ? { from: fromDate, to: toDate } : undefined;

  const displayText =
    value.from && value.to
      ? `${format(new Date(value.from + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} – ${format(new Date(value.to + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`
      : "dd/mm/aaaa – dd/mm/aaaa";

  useEffect(() => {
    if (open) setPending(value);
  }, [open, value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    const from = range.from ? format(range.from, "yyyy-MM-dd") : "";
    const to = range.to ? format(range.to, "yyyy-MM-dd") : "";
    setPending({ from, to });
  };

  const handleConfirm = () => {
    onChange(pending);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-w-[240px] items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 pr-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
      >
        <span
          className={
            value.from && value.to
              ? "text-[hsl(var(--foreground))]"
              : "text-[hsl(var(--muted-foreground))]"
          }
        >
          {displayText}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-lg">
          <DayPicker
            mode="range"
            selected={selected as import("react-day-picker").DateRange | undefined}
            onSelect={handleSelect}
            locale={ptBR}
            numberOfMonths={2}
            defaultMonth={fromDate ?? toDate ?? new Date()}
            className="rdp-root"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-lg bg-[hsl(var(--accent))] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
