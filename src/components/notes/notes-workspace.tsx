"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createNote, updateNote, deleteNote } from "@/app/actions/notes";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  IconSearch,
  IconPlus,
  IconPin,
  IconTrash,
  IconChevronLeft,
} from "@/components/icons";

export type NoteDTO = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  updatedAt: string;
};

export function NotesWorkspace({ initialNotes }: { initialNotes: NoteDTO[] }) {
  const [notes, setNotes] = useState<NoteDTO[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [mobileEditor, setMobileEditor] = useState(false);
  const [, startTransition] = useTransition();

  // Re-sincroniza con el servidor tras un router.refresh() (p. ej. cuando el chat
  // crea/edita/borra una nota). `initialNotes` solo cambia de referencia cuando el
  // RSC se re-renderiza; el autoguardado con debounce ya persistió lo escrito.
  const [syncedInitial, setSyncedInitial] = useState(initialNotes);
  if (initialNotes !== syncedInitial) {
    setSyncedInitial(initialNotes);
    setNotes(initialNotes);
  }

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
        )
      : notes;
    return [...list].sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  }, [notes, query]);

  async function handleNew() {
    const note = await createNote();
    const dto: NoteDTO = {
      id: note.id,
      title: note.title,
      content: note.content,
      pinned: note.pinned,
      updatedAt: note.updatedAt.toString(),
    };
    setNotes((prev) => [dto, ...prev]);
    setSelectedId(note.id);
    setMobileEditor(true);
  }

  function patchLocal(id: string, patch: Partial<NoteDTO>) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
      ),
    );
  }

  function persist(id: string, patch: { title?: string; content?: string; pinned?: boolean }) {
    startTransition(() => {
      void updateNote(id, patch);
    });
  }

  async function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) {
      const rest = notes.filter((n) => n.id !== id);
      setSelectedId(rest[0]?.id ?? null);
    }
    setMobileEditor(false);
    await deleteNote(id);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] md:h-screen">
      {/* Lista */}
      <section
        className={cn(
          "w-full shrink-0 flex-col gap-4 border-r border-border bg-card p-5 md:flex md:w-[328px]",
          mobileEditor ? "hidden" : "flex",
        )}
      >
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">Notas</h1>
          {notes.length > 0 && <span className="text-xs text-muted">{notes.length} {`${notes.length === 1 ? 'nota' : 'notas'}`}</span>}
        </div>

        <label className="flex items-center gap-2.5 rounded-[10px] border border-border bg-panel-muted px-3 py-2.5">
          <IconSearch size={16} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en notas…"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[#8a9e94]"
          />
        </label>

        <button
          type="button"
          onClick={handleNew}
          className="flex items-center justify-center gap-1.5 rounded-[10px] bg-accent px-3 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <IconPlus size={15} />
          Nueva nota
        </button>

        <div className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted">Sin resultados.</p>
          )}
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                setSelectedId(n.id);
                setMobileEditor(true);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-[11px] px-3.5 py-3 text-left transition-colors",
                n.id === selectedId
                  ? "border-l-[3px] border-accent bg-accent-soft"
                  : "hover:bg-panel-muted",
              )}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {n.pinned && <IconPin size={13} filled className="text-accent" />}
                <span className="truncate">{n.title || "Nota sin título"}</span>
              </span>
              <span className="line-clamp-2 text-[12.5px] leading-snug text-muted">
                {n.content.replace(/[#*_`>-]/g, "").trim() || "Vacía"}
              </span>
              <span className="text-[11px] text-[#8a9e94]">
                {relativeTime(new Date(n.updatedAt))}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Editor */}
      <section
        className={cn(
          "flex-1 flex-col bg-card md:flex",
          mobileEditor ? "flex" : "hidden",
        )}
      >
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            onBack={() => setMobileEditor(false)}
            onTitle={(title) => {
              patchLocal(selected.id, { title });
              persist(selected.id, { title });
            }}
            onContent={(content) => {
              patchLocal(selected.id, { content });
              persist(selected.id, { content });
            }}
            onTogglePin={() => {
              const pinned = !selected.pinned;
              patchLocal(selected.id, { pinned });
              persist(selected.id, { pinned });
            }}
            onDelete={() => handleDelete(selected.id)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted">
            Crea una nota para empezar.
          </div>
        )}
      </section>
    </div>
  );
}

function NoteEditor({
  note,
  onBack,
  onTitle,
  onContent,
  onTogglePin,
  onDelete,
}: {
  note: NoteDTO;
  onBack: () => void;
  onTitle: (v: string) => void;
  onContent: (v: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"editar" | "vista">("editar");
  const [savedAt, setSavedAt] = useState<Date>(new Date(note.updatedAt));
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  function scheduleSave(fn: () => void) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      fn();
      setSavedAt(new Date());
    }, 800);
  }

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 md:px-12 md:py-9">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-muted md:hidden"
            aria-label="Volver"
          >
            <IconChevronLeft size={20} />
          </button>
          <span className="text-[12.5px] text-muted">
            Guardado {relativeTime(savedAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-[9px] border border-border text-[12.5px]">
            <button
              type="button"
              onClick={() => setTab("editar")}
              className={cn("px-3 py-1.5", tab === "editar" ? "bg-accent font-semibold text-white" : "bg-panel-muted text-[#8a9e94]")}
            >
              Markdown
            </button>
            <button
              type="button"
              onClick={() => setTab("vista")}
              className={cn("px-3 py-1.5", tab === "vista" ? "bg-accent font-semibold text-white" : "bg-panel-muted text-[#8a9e94]")}
            >
              Vista previa
            </button>
          </div>
          <button
            type="button"
            onClick={onTogglePin}
            className={cn(
              "flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12.5px]",
              note.pinned ? "text-accent" : "text-text",
            )}
          >
            <IconPin size={13} filled={note.pinned} />
            {note.pinned ? "Fijada" : "Fijar"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center rounded-[9px] border border-border px-2.5 py-1.5 text-muted hover:text-red-600"
            aria-label="Eliminar nota"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      <input
        defaultValue={note.title}
        onChange={(e) => scheduleSave(() => onTitle(e.target.value))}
        placeholder="Título"
        className="bg-transparent font-display text-[26px] font-semibold outline-none placeholder:text-border-strong md:text-[28px]"
      />

      {tab === "editar" ? (
        <textarea
          defaultValue={note.content}
          onChange={(e) => scheduleSave(() => onContent(e.target.value))}
          placeholder={"Escribe en markdown…\n\n## Título\n- lista\n> cita"}
          className="min-h-[50vh] flex-1 resize-none bg-transparent font-mono text-[13.5px] leading-relaxed outline-none placeholder:text-border-strong"
        />
      ) : (
        <div className="markdown-body max-w-[680px]">
          {note.content.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          ) : (
            <p className="text-muted">Nada que previsualizar.</p>
          )}
        </div>
      )}
    </div>
  );
}
