"use client";

import { useState, useTransition } from "react";
import { CheckBox } from "@/components/checkbox";
import { toggleTask } from "@/app/actions/tasks";
import { cn } from "@/lib/cn";

type Item = { id: string; title: string; done: boolean };

export function PrioritiesList({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();

  // Re-sincroniza con el servidor tras un router.refresh() (p. ej. cuando el chat
  // crea/edita/borra una tarea prioritaria). `initial` solo cambia de referencia
  // cuando el RSC se re-renderiza.
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (initial !== syncedInitial) {
    setSyncedInitial(initial);
    setItems(initial);
  }

  function toggle(item: Item) {
    const next = !item.done;
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done: next } : x)));
    startTransition(async () => {
      try {
        await toggleTask(item.id, next);
      } catch {
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done: !next } : x)));
      }
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted">Marca una tarea como prioridad para verla aquí.</p>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 text-sm">
          <CheckBox checked={item.done} onToggle={() => toggle(item)} />
          <span className={cn(item.done && "text-muted line-through")}>{item.title}</span>
        </div>
      ))}
    </div>
  );
}
