"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconChat, IconX, IconSend, IconMic } from "@/components/icons";
import { ChatMessage, type ChatRole } from "@/components/chat/chat-message";
import { ProposalCard, type ProposalOutcome } from "@/components/chat/proposal-card";
import { PermissionsNote } from "@/components/chat/permissions-note";
import { streamChat, type ChatEvent } from "@/lib/chat/client";
import { useSpeech } from "@/lib/chat/use-speech";
import type { Proposal } from "@/lib/chat/tools";
import { SUGGESTED_PROMPTS } from "@/lib/chat/prompt";
import { cn } from "@/lib/cn";

type Msg = { id: string; role: ChatRole; content: string };

const AUTO_SEND_SECONDS = 2;
const TEXTAREA_MAX_PX = 140;

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  const full = el.scrollHeight;
  el.style.height = `${Math.min(full, TEXTAREA_MAX_PX)}px`;
  el.style.overflowY = full > TEXTAREA_MAX_PX ? "auto" : "hidden";
}

const TOOL_LABEL: Record<string, string> = {
  list_calendar_events: "Consultando el calendario…",
  search_emails: "Buscando en Gmail…",
  read_email: "Leyendo un correo…",
  list_drive_files: "Revisando Drive…",
  search_tasks: "Buscando tareas…",
  search_notes: "Buscando notas…",
  propose_task_create: "Preparando una tarea…",
  propose_task_update: "Preparando un cambio…",
  propose_task_delete: "Preparando un borrado…",
  propose_note_create: "Preparando una nota…",
  propose_note_update: "Preparando un cambio…",
  propose_note_delete: "Preparando un borrado…",
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  // Resultado de cada propuesta, para que la tarjeta no vuelva a mostrar "Aceptar"
  // al cerrar y reabrir el panel (ProposalCard se re-monta, el widget no).
  const [resolved, setResolved] = useState<Record<string, ProposalOutcome>>({});
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cuenta atrás para auto-enviar tras el dictado (null = inactiva).
  const [autoSend, setAutoSend] = useState<number | null>(null);

  const conversationId = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);
  const autoSendTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false); // evita doble envío por doble submit / carrera
  const inputRef = useRef(input);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    inputRef.current = input;
  });

  // Caja de texto que crece con el contenido (estilo WhatsApp), hasta un tope.
  useEffect(() => {
    const el = textareaRef.current;
    if (el) autoGrow(el);
  }, [input, open]);

  // Carga el hilo guardado la primera vez que se abre.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        conversationId.current = data.conversationId ?? null;
        setMessages(
          (data.messages ?? []).map((m: { id: string; role: ChatRole; content: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
      })
      .catch(() => {
        /* sin hilo previo: se empieza en blanco */
      });
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, activeTools, proposals]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || busy || sendingRef.current) return;
      sendingRef.current = true;

      if (autoSendTimer.current) {
        clearInterval(autoSendTimer.current);
        autoSendTimer.current = null;
      }
      setAutoSend(null);
      setError(null);
      setInput("");
      setProposals([]); // las propuestas anteriores caducan al enviar otro mensaje
      setResolved({});
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: message },
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setBusy(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const onEvent = (e: ChatEvent) => {
        switch (e.type) {
          case "conversation":
            conversationId.current = e.id;
            break;
          case "text":
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + e.delta } : m)),
            );
            break;
          case "reset":
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: "" } : m)),
            );
            break;
          case "tool":
            setActiveTools((prev) =>
              e.phase === "start"
                ? [...prev, e.name]
                : prev.filter((n, idx) => !(n === e.name && idx === prev.indexOf(e.name))),
            );
            break;
          case "proposal":
            setProposals((prev) => [...prev, e.proposal]);
            break;
          case "error":
            setError(e.message);
            break;
          case "done":
            break;
        }
      };

      streamChat({ conversationId: conversationId.current ?? undefined, message }, onEvent, ctrl.signal)
        .catch((err) => {
          if (err?.name !== "AbortError") setError(err?.message ?? "Error de conexión");
        })
        .finally(() => {
          sendingRef.current = false;
          setBusy(false);
          setActiveTools([]);
        });
    },
    [busy],
  );

  const cancelAutoSend = useCallback(() => {
    if (autoSendTimer.current) {
      clearInterval(autoSendTimer.current);
      autoSendTimer.current = null;
    }
    setAutoSend(null);
  }, []);

  useEffect(() => () => cancelAutoSend(), [cancelAutoSend]);

  const speech = useSpeech({
    onTranscript: (text) =>
      setInput((prev) => (prev.trim() ? prev.trimEnd() + " " : "") + text),
    onEnd: (didTranscribe) => {
      if (!didTranscribe || busy || !inputRef.current.trim()) return;
      // Auto-envío con ventana de cancelación.
      cancelAutoSend();
      setAutoSend(AUTO_SEND_SECONDS);
      autoSendTimer.current = setInterval(() => {
        setAutoSend((n) => {
          if (n === null) return null;
          if (n <= 1) {
            if (autoSendTimer.current) clearInterval(autoSendTimer.current);
            autoSendTimer.current = null;
            queueMicrotask(() => send(inputRef.current));
            return null;
          }
          return n - 1;
        });
      }, 1000);
    },
  });

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Abrir asistente"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-black/15 transition hover:bg-accent-hover md:bottom-6 md:right-6"
        >
          <IconChat size={22} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 md:inset-y-0 md:right-0 md:left-auto md:w-[420px]">
          <div
            className="absolute inset-0 bg-black/30 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-full flex-col bg-bg shadow-2xl md:w-[420px]">
            {/* Cabecera */}
            <header className="flex items-start justify-between gap-2 border-b border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="font-display text-[15px] font-semibold">Asistente</p>
                <PermissionsNote variant="header" />
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="shrink-0 text-muted hover:text-text"
              >
                <IconX size={18} />
              </button>
            </header>

            {/* Mensajes */}
            <div ref={scrollRef} className="chat-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && <EmptyState onPick={send} />}

              {messages.map((m, i) => (
                <ChatMessage
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  pending={busy && i === messages.length - 1 && m.role === "assistant"}
                />
              ))}

              {activeTools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeTools.map((name, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-accent-soft-border bg-accent-soft px-2.5 py-1 text-[11px] text-accent-ink"
                    >
                      {TOOL_LABEL[name] ?? "Trabajando…"}
                    </span>
                  ))}
                </div>
              )}

              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  settled={resolved[p.id]}
                  onSettled={(outcome) =>
                    setResolved((r) => ({ ...r, [p.id]: outcome }))
                  }
                />
              ))}

              {error && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                  {error}
                </p>
              )}
            </div>

            {/* Compositor */}
            <div className="border-t border-border bg-card px-3 py-3">
              {speech.error && (
                <p className="mb-1.5 px-1 text-[11px] text-red-600">{speech.error}</p>
              )}
              {autoSend !== null && (
                <div className="mb-1.5 flex items-center justify-between rounded-lg bg-accent-soft px-2.5 py-1.5 text-[12px] text-accent-ink">
                  <span>Enviando en {autoSend}…</span>
                  <button
                    type="button"
                    onClick={cancelAutoSend}
                    className="font-semibold hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-end gap-2 rounded-2xl border border-border px-2.5 py-1.5 focus-within:border-accent"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    cancelAutoSend();
                    setInput(e.target.value);
                    autoGrow(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder={
                    speech.listening
                      ? "Escuchando…"
                      : "Pregunta sobre tu agenda, correos, archivos…"
                  }
                  className="chat-scroll min-h-[24px] flex-1 resize-none overflow-y-hidden bg-transparent py-1 text-sm leading-snug outline-none placeholder:text-muted"
                  style={{ maxHeight: TEXTAREA_MAX_PX }}
                />
                {speech.supported && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelAutoSend();
                      speech.toggle();
                    }}
                    aria-label={speech.listening ? "Detener dictado" : "Dictar por voz"}
                    className={cn(
                      "mb-0.5 shrink-0 rounded-lg p-1.5 transition",
                      speech.listening
                        ? "animate-pulse bg-red-600 text-white"
                        : "text-muted hover:text-text",
                    )}
                  >
                    <IconMic size={16} active={speech.listening} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Enviar"
                  className={cn(
                    "mb-0.5 shrink-0 rounded-lg p-1.5 text-white transition",
                    busy || !input.trim() ? "bg-border-strong" : "bg-accent hover:bg-accent-hover",
                  )}
                >
                  <IconSend size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="space-y-3 py-2">
      <PermissionsNote variant="full" />
      <div className="flex flex-col gap-1.5">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-left text-[13px] hover:border-accent-soft-border hover:bg-accent-soft/40"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
