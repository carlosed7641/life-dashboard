import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { parseDay } from "@/lib/format";
import { GoogleConnectionError } from "@/lib/google/client";
import { listEvents } from "@/lib/google/calendar";
import { searchEmails, readEmail } from "@/lib/google/gmail";
import { listFiles } from "@/lib/google/drive";

/* ------------------------------------------------------------------ *
 * Propuestas de escritura (el modelo propone, el usuario confirma).
 * runTool NUNCA muta la base de datos: devuelve una Proposal que la
 * ruta emite por SSE y la UI convierte en tarjeta de confirmación.
 * ------------------------------------------------------------------ */

export type ProposalKind =
  | "task_create"
  | "task_update"
  | "task_delete"
  | "note_create"
  | "note_update"
  | "note_delete";

export type Proposal = {
  id: string;
  kind: ProposalKind;
  targetId: string | null; // id del registro afectado (update/delete)
  before: Record<string, unknown> | null; // estado actual, para el antes→después
  values: Record<string, unknown>; // cambios propuestos
};

export type RunToolOutput = {
  content: string; // JSON serializado → contenido del tool_result
  proposal?: Proposal;
};

const MB = 1024 * 1024;

/* ------------------------------- Tools ------------------------------ */

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_calendar_events",
    description:
      "Eventos del Google Calendar del usuario en un rango de fechas. Devuelve título, horario, descripción, ubicación e invitados. Solo lectura. `from` y `to` son fechas-hora ISO 8601; interprétalas en la zona horaria del usuario (America/Bogota) usando la fecha actual que se te da en el prompt. Para 'el jueves' pasa from=inicio del jueves y to=fin del jueves.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Inicio del rango, ISO 8601." },
        to: { type: "string", description: "Fin del rango, ISO 8601." },
        limit: { type: "number", description: "Máx. eventos (1-250, def. 50)." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "search_emails",
    description:
      "Busca en el Gmail del usuario con la sintaxis nativa de Gmail. Ejemplos de `query`: 'is:unread', 'from:banco newer_than:7d', 'has:attachment', 'subject:factura'. Por defecto solo mira la BANDEJA PRINCIPAL (excluye Promociones, Social, Notificaciones y Spam), igual que la vista de Correos de la app. Para incluir otras pestañas, añade un `category:` explícito (p. ej. 'category:promotions') o 'in:anywhere'. Devuelve remitente, asunto, fecha y un fragmento (snippet), NO el cuerpo completo — para eso usa read_email. Solo lectura.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query estilo Gmail." },
        limit: { type: "number", description: "Máx. correos (1-50, def. 10)." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_email",
    description:
      "Devuelve el cuerpo completo (texto) de un correo concreto, para poder redactar una respuesta o citarlo. El `id` sale de search_emails. El cuerpo se recorta a ~6000 caracteres (campo `truncated`). Solo lectura — NO envía nada.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "id del correo (de search_emails)." } },
      required: ["id"],
    },
  },
  {
    name: "list_drive_files",
    description:
      "Lista archivos del Google Drive del usuario e informa el tamaño de cada uno. Úsalo para contar o filtrar por tamaño/tipo. Por defecto SOLO incluye archivos de los que el usuario es PROPIETARIO — no los que otras personas han compartido con él; pasa `includeShared: true` solo si el usuario pide explícitamente incluir los compartidos. `q` acepta la sintaxis de búsqueda de Drive (opcional). Los filtros `minSizeMB`/`maxSizeMB` se aplican en el servidor y la respuesta trae `matchedCount` ya calculado — úsalo tal cual, no recuentes la lista. IMPORTANTE: los archivos nativos de Google (Documentos, Hojas de cálculo, Presentaciones) NO reportan tamaño (`sizeBytes` = null) y quedan fuera de cualquier filtro por tamaño. Si `scanTruncated` es true, di 'al menos N'. Solo lectura.",
    input_schema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Query de Drive, opcional. Ej: \"mimeType='application/pdf'\"." },
        orderBy: { type: "string", description: "Orden Drive, ej. 'modifiedTime desc', 'quotaBytesUsed desc'." },
        minSizeMB: { type: "number", description: "Filtra archivos de al menos N MB." },
        maxSizeMB: { type: "number", description: "Filtra archivos de como mucho N MB." },
        category: {
          type: "string",
          enum: ["image", "video", "audio", "pdf", "document", "spreadsheet", "presentation", "folder", "archive", "code", "file"],
          description: "Filtra por categoría de archivo.",
        },
        includeShared: {
          type: "boolean",
          description: "true = incluir también archivos compartidos con el usuario (por defecto solo los suyos).",
        },
        limit: { type: "number", description: "Máx. archivos a listar en la respuesta (1-50, def. 30). No afecta a matchedCount." },
      },
      required: [],
    },
  },
  {
    name: "search_tasks",
    description:
      "Busca tareas del usuario (guardadas en la app). Filtros opcionales por estado, prioridad, texto del título y rango de fecha de vencimiento (YYYY-MM-DD, granularidad de día). Devuelve el `id` de cada tarea, necesario para proponer editarla o borrarla.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar en el título (sin distinguir mayúsculas)." },
        done: { type: "boolean", description: "true = completadas, false = pendientes." },
        priority: { type: "boolean", description: "true = solo prioritarias." },
        dueAfter: { type: "string", description: "Vence en o después de esta fecha (YYYY-MM-DD)." },
        dueBefore: { type: "string", description: "Vence en o antes de esta fecha (YYYY-MM-DD)." },
        limit: { type: "number", description: "Máx. resultados (1-100, def. 30)." },
      },
      required: [],
    },
  },
  {
    name: "search_notes",
    description:
      "Busca notas del usuario (guardadas en la app) por texto de título o contenido. Devuelve el `id` de cada nota, necesario para proponer editarla o borrarla.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar en título o contenido." },
        pinned: { type: "boolean", description: "true = solo notas fijadas." },
        limit: { type: "number", description: "Máx. resultados (1-50, def. 20)." },
      },
      required: [],
    },
  },
  {
    name: "propose_task_create",
    description:
      "Propone crear una tarea. NO la crea: el usuario debe confirmar en una tarjeta. Úsalo cuando el usuario pida anotar o recordar algo.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueDate: { type: "string", description: "Fecha de vencimiento YYYY-MM-DD, opcional." },
        priority: { type: "boolean", description: "Marcar como prioritaria." },
      },
      required: ["title"],
    },
  },
  {
    name: "propose_task_update",
    description:
      "Propone modificar una tarea existente. Requiere el `id` (obtenlo de search_tasks). NO aplica el cambio: el usuario confirma. Si search_tasks devuelve varias tareas que podrían encajar, pregunta cuál antes de proponer.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        dueDate: { type: ["string", "null"], description: "YYYY-MM-DD, o null para quitar la fecha." },
        done: { type: "boolean" },
        priority: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "propose_task_delete",
    description:
      "Propone borrar una tarea. Requiere el `id` (de search_tasks). NO la borra: el usuario confirma. Si hay ambigüedad sobre cuál, pregunta antes.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "propose_note_create",
    description: "Propone crear una nota con título y contenido (markdown). NO la crea: el usuario confirma.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string", description: "Contenido en markdown." },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "propose_note_update",
    description:
      "Propone modificar una nota existente. Requiere el `id` (de search_notes). NO aplica el cambio: el usuario confirma. Ante ambigüedad, pregunta.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        pinned: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "propose_note_delete",
    description:
      "Propone borrar una nota. Requiere el `id` (de search_notes). NO la borra: el usuario confirma. Ante ambigüedad, pregunta.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

/* ---------------------------- Despachador --------------------------- */

const GOOGLE_TOOLS = new Set(["list_calendar_events", "search_emails", "read_email", "list_drive_files"]);
const TOOL_LABEL: Record<string, string> = {
  list_calendar_events: "Calendar",
  search_emails: "Gmail",
  read_email: "Gmail",
  list_drive_files: "Drive",
};

export async function runTool(
  name: string,
  input: unknown,
  userId: string,
): Promise<RunToolOutput> {
  try {
    return await dispatch(name, input, userId);
  } catch (e) {
    if (e instanceof GoogleConnectionError) {
      return json({ error: "sin_acceso", tool: TOOL_LABEL[name] ?? "Google" });
    }
    if (GOOGLE_TOOLS.has(name)) {
      return json({ error: "fallo_temporal", tool: TOOL_LABEL[name] ?? "Google", detail: msg(e) });
    }
    throw e;
  }
}

async function dispatch(name: string, input: unknown, userId: string): Promise<RunToolOutput> {
  const i = asRecord(input);

  switch (name) {
    /* ----------------------------- Google --------------------------- */
    case "list_calendar_events": {
      const events = await listEvents(
        { from: str(i.from), to: str(i.to), limit: num(i.limit) ?? undefined },
        userId,
      );
      return json({
        count: events.length,
        events: events.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          allDay: e.allDay,
          past: e.past,
          description: e.description,
          location: e.location,
          attendees: e.attendees,
          recurring: e.recurring,
          link: e.htmlLink,
        })),
      });
    }

    case "search_emails": {
      const { emails, total } = await searchEmails(
        { query: str(i.query), limit: num(i.limit) ?? undefined },
        userId,
      );
      return json({
        totalEstimate: total,
        returned: emails.length,
        emails: emails.map((m) => ({
          id: m.id,
          from: m.from,
          fromEmail: m.fromEmail,
          subject: m.subject,
          date: m.date.toISOString(),
          unread: m.unread,
          hasAttachments: m.hasAttachments,
          snippet: m.snippet,
          link: m.link,
        })),
      });
    }

    case "read_email": {
      const body = await readEmail(str(i.id), userId);
      return json({
        id: body.id,
        from: body.from,
        to: body.to,
        subject: body.subject,
        date: body.date.toISOString(),
        truncated: body.truncated,
        body: body.body,
      });
    }

    case "list_drive_files": {
      const { files, truncated } = await listFiles(
        {
          q: str(i.q) || undefined,
          orderBy: str(i.orderBy) || undefined,
          includeShared: i.includeShared === true,
        },
        userId,
      );
      const minBytes = num(i.minSizeMB) != null ? num(i.minSizeMB)! * MB : null;
      const maxBytes = num(i.maxSizeMB) != null ? num(i.maxSizeMB)! * MB : null;
      const category = str(i.category);
      const limit = clamp(num(i.limit) ?? 30, 1, 50);
      const sizeFilter = minBytes != null || maxBytes != null;

      let matched = files;
      if (minBytes != null) matched = matched.filter((f) => f.sizeBytes != null && f.sizeBytes >= minBytes);
      if (maxBytes != null) matched = matched.filter((f) => f.sizeBytes != null && f.sizeBytes <= maxBytes);
      if (category) matched = matched.filter((f) => f.category === category);

      return json({
        matchedCount: matched.length,
        scannedCount: files.length,
        scanTruncated: truncated,
        filesWithoutSize: sizeFilter ? files.filter((f) => f.sizeBytes == null).length : undefined,
        note: sizeFilter
          ? "Los archivos nativos de Google (Documentos/Hojas/Presentaciones) no reportan tamaño y no cuentan para el filtro."
          : undefined,
        files: matched.slice(0, limit).map((f) => ({
          id: f.id,
          name: f.name,
          kind: f.kind,
          category: f.category,
          sizeBytes: f.sizeBytes,
          sizeMB: f.sizeBytes != null ? round1(f.sizeBytes / MB) : null,
          modified: f.modifiedTime.toISOString(),
          link: f.webViewLink,
        })),
      });
    }

    /* ---------------------------- App: lectura ---------------------- */
    case "search_tasks": {
      const query = str(i.query);
      const dueAfter = str(i.dueAfter);
      const dueBefore = str(i.dueBefore);
      const tasks = await prisma.task.findMany({
        where: {
          userId,
          ...(typeof i.done === "boolean" ? { done: i.done } : {}),
          ...(typeof i.priority === "boolean" ? { priority: i.priority } : {}),
          ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
          ...(dueAfter || dueBefore
            ? {
                dueDate: {
                  ...(dueAfter ? { gte: parseDay(dueAfter) } : {}),
                  ...(dueBefore ? { lte: parseDay(dueBefore) } : {}),
                },
              }
            : {}),
        },
        orderBy: [{ done: "asc" }, { priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        take: clamp(num(i.limit) ?? 30, 1, 100),
      });
      return json({
        count: tasks.length,
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
          createdAt: t.createdAt.toISOString(),
        })),
      });
    }

    case "search_notes": {
      const query = str(i.query);
      const notes = await prisma.note.findMany({
        where: {
          userId,
          ...(typeof i.pinned === "boolean" ? { pinned: i.pinned } : {}),
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" as const } },
                  { content: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        take: clamp(num(i.limit) ?? 20, 1, 50),
      });
      return json({
        count: notes.length,
        notes: notes.map((n) => ({
          id: n.id,
          title: n.title,
          pinned: n.pinned,
          excerpt: n.content.length > 400 ? n.content.slice(0, 400) + "…" : n.content,
          updatedAt: n.updatedAt.toISOString(),
        })),
      });
    }

    /* -------------------------- App: propuestas -------------------- */
    case "propose_task_create": {
      const title = str(i.title);
      if (!title) return json({ error: "falta_titulo" });
      return proposal({
        kind: "task_create",
        targetId: null,
        before: null,
        values: {
          title,
          ...(str(i.dueDate) ? { dueDate: str(i.dueDate) } : {}),
          ...(typeof i.priority === "boolean" ? { priority: i.priority } : {}),
        },
      });
    }

    case "propose_task_update": {
      const id = str(i.id);
      if (!id) return json({ error: "falta_id" });
      const task = await prisma.task.findFirst({ where: { id, userId } });
      if (!task) return json({ error: "no_encontrado", hint: "Usa search_tasks para el id correcto." });
      const values: Record<string, unknown> = {};
      if (i.title !== undefined) values.title = str(i.title);
      if (i.dueDate !== undefined) values.dueDate = i.dueDate === null ? null : str(i.dueDate);
      if (typeof i.done === "boolean") values.done = i.done;
      if (typeof i.priority === "boolean") values.priority = i.priority;
      if (Object.keys(values).length === 0) return json({ error: "sin_cambios" });
      return proposal({
        kind: "task_update",
        targetId: id,
        before: {
          title: task.title,
          dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
          done: task.done,
          priority: task.priority,
        },
        values,
      });
    }

    case "propose_task_delete": {
      const id = str(i.id);
      if (!id) return json({ error: "falta_id" });
      const task = await prisma.task.findFirst({ where: { id, userId } });
      if (!task) return json({ error: "no_encontrado", hint: "Usa search_tasks para el id correcto." });
      return proposal({
        kind: "task_delete",
        targetId: id,
        before: {
          title: task.title,
          dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
          done: task.done,
          priority: task.priority,
        },
        values: {},
      });
    }

    case "propose_note_create": {
      const title = str(i.title);
      const content = typeof i.content === "string" ? i.content : "";
      if (!title) return json({ error: "falta_titulo" });
      return proposal({
        kind: "note_create",
        targetId: null,
        before: null,
        values: { title, content },
      });
    }

    case "propose_note_update": {
      const id = str(i.id);
      if (!id) return json({ error: "falta_id" });
      const note = await prisma.note.findFirst({ where: { id, userId } });
      if (!note) return json({ error: "no_encontrado", hint: "Usa search_notes para el id correcto." });
      const values: Record<string, unknown> = {};
      if (i.title !== undefined) values.title = str(i.title);
      if (typeof i.content === "string") values.content = i.content;
      if (typeof i.pinned === "boolean") values.pinned = i.pinned;
      if (Object.keys(values).length === 0) return json({ error: "sin_cambios" });
      return proposal({
        kind: "note_update",
        targetId: id,
        before: {
          title: note.title,
          pinned: note.pinned,
          content: note.content.length > 160 ? note.content.slice(0, 160) + "…" : note.content,
        },
        values,
      });
    }

    case "propose_note_delete": {
      const id = str(i.id);
      if (!id) return json({ error: "falta_id" });
      const note = await prisma.note.findFirst({ where: { id, userId } });
      if (!note) return json({ error: "no_encontrado", hint: "Usa search_notes para el id correcto." });
      return proposal({
        kind: "note_delete",
        targetId: id,
        before: { title: note.title, pinned: note.pinned },
        values: {},
      });
    }

    default:
      return json({ error: "herramienta_desconocida", name });
  }
}

/* ----------------------------- Helpers ----------------------------- */

function json(x: unknown): RunToolOutput {
  return { content: JSON.stringify(x) };
}

function proposal(p: Omit<Proposal, "id">): RunToolOutput {
  const full: Proposal = { id: crypto.randomUUID(), ...p };
  return { content: JSON.stringify({ status: "pending_confirmation", proposalId: full.id }), proposal: full };
}

function asRecord(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" ? (x as Record<string, unknown>) : {};
}

function str(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function num(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(Math.round(n), lo), hi);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
