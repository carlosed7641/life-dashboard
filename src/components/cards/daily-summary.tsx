"use client";

import { useState, useTransition } from "react";
import { generateDailySummary } from "@/app/actions/summary";
import { IconBrief } from "@/components/icons";

export function DailySummaryButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(false);
          startTransition(async () => {
            try {
              await generateDailySummary();
            } catch {
              setError(true);
            }
          });
        }}
        className="flex items-center gap-2 rounded-[11px] bg-accent px-[18px] py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        <IconBrief size={16} />
        {pending ? "Generando…" : "Resumen diario"}
      </button>
      {error && <span className="text-xs text-red-600">No se pudo generar. Reintenta.</span>}
    </div>
  );
}
