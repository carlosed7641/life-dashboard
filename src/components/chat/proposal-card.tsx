"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { Proposal } from "@/lib/chat/tools";
import { applyProposal, undoProposal, type UndoToken } from "@/app/actions/chat-proposals";

const KIND_META: Record<
  Proposal["kind"],
  { label: string; verb: string; danger?: boolean }
> = {
  task_create: { label: "Nueva tarea", verb: "Crear" },
  task_update: { label: "Editar tarea", verb: "Guardar" },
  task_delete: { label: "Borrar tarea", verb: "Eliminar", danger: true },
  note_create: { label: "Nueva nota", verb: "Crear" },
  note_update: { label: "Editar nota", verb: "Guardar" },
  note_delete: { label: "Borrar nota", verb: "Eliminar", danger: true },
};

const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  dueDate: "Fecha",
  done: "Completada",
  priority: "Prioridad",
  content: "Contenido",
  pinned: "Fijada",
};

const UNDO_SECONDS = 8;

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  const s = String(v);
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
}

type Phase = "idle" | "working" | "done" | "undone" | "discarded" | "error";
export type ProposalOutcome = "done" | "undone" | "discarded";

export function ProposalCard({
  proposal,
  settled,
  onSettled,
}: {
  proposal: Proposal;
  /** Resultado ya registrado por el padre — sobrevive a cerrar/abrir el panel. */
  settled?: ProposalOutcome;
  onSettled?: (outcome: ProposalOutcome) => void;
}) {
  const meta = KIND_META[proposal.kind];
  const [phase, setPhase] = useState<Phase>(settled ?? "idle");
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoToken | null>(null);
  const [secs, setSecs] = useState(0);
  const [, start] = useTransition();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  function confirm() {
    setError(null);
    setPhase("working");
    start(async () => {
      const res = await applyProposal({
        kind: proposal.kind,
        targetId: proposal.targetId,
        values: proposal.values,
      });
      if (!res.ok) {
        setPhase("error");
        setError(res.error);
        return;
      }
      setPhase("done");
      onSettled?.("done");
      router.refresh(); // refresca /tareas, /notas o el panel si el usuario los tiene abiertos
      if (res.undo) {
        setUndo(res.undo);
        setSecs(UNDO_SECONDS);
        timer.current = setInterval(() => {
          setSecs((n) => {
            if (n <= 1) {
              if (timer.current) clearInterval(timer.current);
              setUndo(null);
              return 0;
            }
            return n - 1;
          });
        }, 1000);
      }
    });
  }

  function runUndo() {
    if (!undo) return;
    if (timer.current) clearInterval(timer.current);
    const token = undo;
    setUndo(null);
    start(async () => {
      await undoProposal(token);
      setPhase("undone");
      onSettled?.("undone");
      router.refresh();
    });
  }

  const kind = proposal.kind;
  const isCreate = kind.endsWith("_create");
  const isUpdate = kind.endsWith("_update");
  const isDelete = kind.endsWith("_delete");

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-[13px]",
        meta.danger
          ? "border-red-200 bg-red-50"
          : "border-accent-soft-border bg-accent-soft/40",
      )}
    >
      <p className={cn("mb-1.5 font-semibold", meta.danger && "text-red-700")}>{meta.label}</p>

      {isCreate && (
        <dl className="space-y-0.5">
          {Object.entries(proposal.values).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="shrink-0 text-muted">{FIELD_LABEL[k] ?? k}:</dt>
              <dd className="min-w-0">{fmt(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {isUpdate && (
        <dl className="space-y-1">
          {Object.entries(proposal.values).map(([k, v]) => (
            <div key={k} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="shrink-0 text-muted">{FIELD_LABEL[k] ?? k}:</dt>
              <dd className="min-w-0 text-muted line-through">{fmt(proposal.before?.[k])}</dd>
              <dd className="min-w-0 font-medium">→ {fmt(v)}</dd>
            </div>
          ))}
        </dl>
      )}

      {isDelete && (
        <p>
          <span className="text-muted">Se eliminará: </span>
          <span className="font-medium">{fmt(proposal.before?.title)}</span>
        </p>
      )}

      {phase === "idle" && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={confirm}
            className={cn(
              "rounded-lg px-3 py-1 text-[12px] font-semibold text-white",
              meta.danger ? "bg-red-600 hover:bg-red-700" : "bg-accent hover:bg-accent-hover",
            )}
          >
            {meta.verb}
          </button>
          <button
            type="button"
            onClick={() => {
              setPhase("discarded");
              onSettled?.("discarded");
            }}
            className="rounded-lg px-3 py-1 text-[12px] font-semibold text-muted hover:text-text"
          >
            Descartar
          </button>
        </div>
      )}

      {phase === "working" && <p className="mt-2 text-[12px] text-muted">Aplicando…</p>}

      {phase === "done" && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
          <IconCheck size={13} /> Hecho.
          {undo && (
            <button
              type="button"
              onClick={runUndo}
              className="font-semibold text-accent hover:text-accent-hover"
            >
              Deshacer ({secs})
            </button>
          )}
        </div>
      )}

      {phase === "undone" && <p className="mt-2 text-[12px] text-muted">Cambio deshecho.</p>}
      {phase === "discarded" && <p className="mt-2 text-[12px] text-muted">Descartado.</p>}
      {phase === "error" && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
