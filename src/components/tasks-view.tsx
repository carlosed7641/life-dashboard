"use client";

import { useState, useTransition } from "react";
import { CheckBox } from "@/components/checkbox";
import {
  IconPlus,
  IconStar,
  IconTrash,
  IconPencil,
  IconCheck,
  IconX,
} from "@/components/icons";
import { dueLabel, parseDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  createTask,
  toggleTask,
  setTaskPriority,
  updateTask,
  deleteTask,
} from "@/app/actions/tasks";

type Task = {
  id: string;
  title: string;
  done: boolean;
  priority: boolean;
  dueDate: string | null;
};

export function TasksView({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [, startTransition] = useTransition();

  // El servidor es la fuente de verdad tras un router.refresh() (p. ej. cuando el
  // chat crea/edita/borra una tarea). `initial` solo cambia de referencia cuando
  // el RSC se re-renderiza, así que re-sincronizamos la lista en ese momento.
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setTasks(initial);
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    const optimistic: Task = {
      id: `tmp-${Date.now()}`,
      title: value,
      done: false,
      priority: false,
      dueDate: due || null,
    };
    setTasks((prev) => [optimistic, ...prev]);
    setTitle("");
    setDue("");
    startTransition(() => {
      void createTask({ title: value, dueDate: due || null });
    });
  }

  function toggle(t: Task) {
    const next = !t.done;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: next } : x)));
    startTransition(() => {
      void toggleTask(t.id, next);
    });
  }

  function star(t: Task) {
    const next = !t.priority;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, priority: next } : x)));
    startTransition(() => {
      void setTaskPriority(t.id, next);
    });
  }

  function edit(id: string, patch: { title?: string; dueDate?: string | null }) {
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    startTransition(() => {
      void updateTask(id, patch);
    });
  }

  function remove(t: Task) {
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    startTransition(() => {
      void deleteTask(t.id);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={add}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 sm:flex-row sm:items-center"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Añadir una tarea…"
          className="flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-lg border border-border px-2 py-1.5 text-sm text-muted outline-none"
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-1.5 rounded-[10px] bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          <IconPlus size={15} />
          Añadir
        </button>
      </form>

      <TaskGroup title={`Pendientes (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="p-3 text-sm text-muted">Nada pendiente.</p>
        ) : (
          pending.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggle(t)}
              onStar={() => star(t)}
              onRemove={() => remove(t)}
              onEdit={(patch) => edit(t.id, patch)}
            />
          ))
        )}
      </TaskGroup>

      {done.length > 0 && (
        <TaskGroup title={`Completadas (${done.length})`}>
          {done.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggle(t)}
              onStar={() => star(t)}
              onRemove={() => remove(t)}
              onEdit={(patch) => edit(t.id, patch)}
            />
          ))}
        </TaskGroup>
      )}
    </div>
  );
}

function TaskGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="mb-1 font-display text-[13px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
  onStar,
  onRemove,
  onEdit,
}: {
  task: Task;
  onToggle: () => void;
  onStar: () => void;
  onRemove: () => void;
  onEdit: (patch: { title?: string; dueDate?: string | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDue, setDraftDue] = useState(task.dueDate?.slice(0, 10) ?? "");
  const isTemp = task.id.startsWith("tmp-");

  function startEdit() {
    if (isTemp) return;
    setDraftTitle(task.title);
    setDraftDue(task.dueDate?.slice(0, 10) ?? "");
    setEditing(true);
  }

  function save() {
    const t = draftTitle.trim();
    if (!t) return;
    onEdit({ title: t, dueDate: draftDue || null });
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 text-sm">
        <CheckBox checked={task.done} disabled />
        <input
          autoFocus
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
        />
        <input
          type="date"
          value={draftDue}
          onChange={(e) => setDraftDue(e.target.value)}
          className="shrink-0 rounded-md border border-border px-1.5 py-1 text-xs text-muted outline-none"
        />
        <button
          type="button"
          onClick={save}
          aria-label="Guardar"
          className="shrink-0 text-accent hover:text-accent-hover"
        >
          <IconCheck size={16} />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancelar"
          className="shrink-0 text-muted hover:text-text"
        >
          <IconX size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-3 text-sm">
      <CheckBox checked={task.done} onToggle={onToggle} />
      <button
        type="button"
        onClick={startEdit}
        disabled={isTemp}
        title="Editar"
        className={cn(
          "min-w-0 flex-1 truncate text-left",
          task.done && "text-muted line-through",
        )}
      >
        {task.title}
      </button>
      {task.dueDate && (
        <span className="shrink-0 text-xs text-muted">{dueLabel(parseDay(task.dueDate))}</span>
      )}
      <button
        type="button"
        onClick={startEdit}
        disabled={isTemp}
        aria-label="Editar"
        className="shrink-0 text-border-strong hover:text-muted disabled:opacity-30"
      >
        <IconPencil size={15} />
      </button>
      <button
        type="button"
        onClick={onStar}
        aria-label="Prioridad"
        className={cn("shrink-0", task.priority ? "text-accent" : "text-border-strong hover:text-muted")}
      >
        <IconStar size={16} filled={task.priority} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar"
        className="shrink-0 text-border-strong hover:text-red-600"
      >
        <IconTrash size={15} />
      </button>
    </div>
  );
}
