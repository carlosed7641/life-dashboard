"use client";

import { useEffect, useState } from "react";
import { IconBell, IconX } from "@/components/icons";

export type UpcomingEvent = {
  id: string;
  title: string;
  startISO: string;
  htmlLink: string;
};

const LEAD_MS = 30 * 60 * 1000; // avisar cuando falten 30 min o menos
const STORAGE_KEY = "upcoming-dismissed";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addDismissed(id: string) {
  try {
    const current = readDismissed();
    if (!current.includes(id)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, id].slice(-200)));
    }
  } catch {
    /* localStorage no disponible: el aviso solo no persistirá el descarte */
  }
}

export function UpcomingToast({ events }: { events: UpcomingEvent[] }) {
  const [current, setCurrent] = useState<(UpcomingEvent & { minutes: number }) | null>(null);

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const dismissed = readDismissed();
      const next = events
        .map((e) => ({ ...e, diff: new Date(e.startISO).getTime() - now }))
        .filter((e) => e.diff > 0 && e.diff <= LEAD_MS && !dismissed.includes(e.id))
        .sort((a, b) => a.diff - b.diff)[0];
      setCurrent(
        next ? { ...next, minutes: Math.max(1, Math.round(next.diff / 60_000)) } : null,
      );
    }
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [events]);

  if (!current) return null;

  return (
    <div className="fixed bottom-40 right-4 z-40 w-[320px] max-w-[calc(100vw-2rem)] md:bottom-24 md:right-6">
      <div className="flex items-start gap-3 rounded-2xl border border-accent-soft-border bg-card p-4 shadow-lg shadow-black/5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-[#15803d]">
          <IconBell size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">
            Empieza en {current.minutes} min{current.minutes === 1 ? "uto" : "utos"}
          </p>
          <p className="truncate text-sm">{current.title}</p>
          <a
            href={current.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[12px] font-semibold text-accent hover:text-accent-hover"
          >
            Abrir en Calendar
          </a>
        </div>
        <button
          type="button"
          aria-label="Descartar"
          onClick={() => {
            addDismissed(current.id);
            setCurrent(null);
          }}
          className="shrink-0 text-muted hover:text-text"
        >
          <IconX size={16} />
        </button>
      </div>
    </div>
  );
}
