"use client";

import { useState } from "react";
import { IconLock, IconPencil } from "@/components/icons";
import { cn } from "@/lib/cn";

const ROWS = [
  {
    Icon: IconLock,
    title: "Google (Calendar, Gmail, Drive)",
    body: "Solo lectura. No puedo crear, editar ni borrar nada.",
  },
  {
    Icon: IconPencil,
    title: "Tareas y notas",
    body: "Puedo crear, editar y borrar — siempre con tu confirmación.",
  },
];

/**
 * `header`  → línea compacta en la cabecera del panel; se despliega al pulsar.
 * `full`    → tarjeta con las dos filas, para el estado vacío del chat.
 */
export function PermissionsNote({ variant }: { variant: "header" | "full" }) {
  const [open, setOpen] = useState(false);

  if (variant === "full") return <Detail framed />;

  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[11px] text-muted hover:text-text"
      >
        <IconLock size={12} />
        Google: solo lectura · Tareas y notas: edición
        <span className="text-[9px] text-border-strong">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1.5">
          <Detail />
        </div>
      )}
    </div>
  );
}

function Detail({ framed }: { framed?: boolean }) {
  return (
    <div
      className={cn(
        "space-y-2 text-[13px]",
        framed && "rounded-2xl border border-border bg-card p-3.5",
      )}
    >
      {ROWS.map(({ Icon, title, body }) => (
        <p key={title} className="flex gap-2">
          <Icon size={15} className="mt-0.5 shrink-0 text-muted" />
          <span>
            <strong>{title}:</strong> {body}
          </span>
        </p>
      ))}
    </div>
  );
}
