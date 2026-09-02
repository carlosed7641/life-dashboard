import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getTodayEvents } from "@/lib/google/calendar";
import { getUnreadEmails } from "@/lib/google/gmail";
import { GoogleConnectionError } from "@/lib/google/client";
import { dueLabel, formatLongDate } from "@/lib/format";
import { todayKey } from "@/lib/time";

const MODEL = "claude-sonnet-5";

export type SummaryState = {
  content: string | null;
  date: string;
  generatedAt: Date | null;
};

export async function getTodaySummary(userId: string): Promise<SummaryState> {
  const date = todayKey();
  const row = await prisma.dailySummary.findUnique({
    where: { userId_date: { userId, date } },
  });
  return {
    content: row?.content ?? null,
    date,
    generatedAt: row?.createdAt ?? null,
  };
}

/**
 * Genera (o devuelve, si `force` es falso y ya existe) el resumen de hoy.
 * Usada por el botón "Resumen diario" y por el cron matutino.
 */
export async function generateSummaryForUser(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<SummaryState> {
  const date = todayKey();

  if (!opts.force) {
    const existing = await getTodaySummary(userId);
    if (existing.content) return existing;
  }

  const [events, unread, tasks] = await Promise.all([
    getTodayEvents(userId).catch((e) => {
      if (e instanceof GoogleConnectionError) return null;
      throw e;
    }),
    getUnreadEmails(8, userId).catch((e) => {
      if (e instanceof GoogleConnectionError) return null;
      throw e;
    }),
    prisma.task.findMany({
      where: { userId, done: false },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 12,
    }),
  ]);

  const lines: string[] = [`Fecha: ${formatLongDate(new Date())}`, ""];

  lines.push("Eventos de hoy:");
  if (events === null) lines.push("- (sin acceso a Google Calendar)");
  else if (events.length === 0) lines.push("- Sin eventos");
  else events.forEach((e) => lines.push(`- ${e.time} · ${e.title}`));
  lines.push("");

  lines.push("Correos sin leer:");
  if (unread === null) lines.push("- (sin acceso a Gmail)");
  else if (unread.emails.length === 0) lines.push("- Ninguno");
  else {
    lines.push(`(${unread.total} en total)`);
    unread.emails.forEach((m) => lines.push(`- ${m.from}: ${m.subject}`));
  }
  lines.push("");

  lines.push("Tareas pendientes:");
  if (tasks.length === 0) lines.push("- Ninguna");
  else
    tasks.forEach((t) =>
      lines.push(
        `- ${t.title}${t.priority ? " [prioridad]" : ""}${t.dueDate ? ` (vence ${dueLabel(t.dueDate)})` : ""}`,
      ),
    );

  const content = await callClaude(lines.join("\n"));

  const row = await prisma.dailySummary.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, content },
    update: { content },
  });

  return { content: row.content, date, generatedAt: row.createdAt };
}

async function callClaude(context: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Configura ANTHROPIC_API_KEY para generar el resumen diario con IA.";
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      "Eres el asistente de un dashboard personal. A partir de los datos del día del usuario, " +
      "redacta un resumen breve en español (3-4 frases, tono cercano y directo, sin saludos largos). " +
      "Di qué tiene por delante, qué es urgente y dónde quedan huecos libres. " +
      "No inventes datos ni añadas información que no esté en el contexto.",
    messages: [{ role: "user", content: context }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
