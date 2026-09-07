import { google } from "googleapis";
import { getGoogleClient, resolveUserId, SCOPES, withGoogleAuth } from "./client";
import { memo } from "@/lib/memo";
import { formatTime } from "@/lib/format";

export type UnreadEmail = {
  id: string;
  from: string; // nombre para mostrar, o el correo si no hay nombre
  fromEmail: string;
  subject: string;
  time: string; // "9:15 a. m."
  date: Date;
  link: string; // URL para abrir el correo en Gmail
};

export type UnreadResult = {
  emails: UnreadEmail[];
  total: number; // estimación de no leídos en la bandeja principal
};

export type EmailHit = UnreadEmail & {
  snippet: string;
  unread: boolean;
  hasAttachments: boolean;
};

export type EmailSearchResult = {
  emails: EmailHit[];
  total: number; // estimación de coincidencias de la query
};

export type EmailBody = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  body: string;
  truncated: boolean;
};

const BODY_LIMIT = 6000;

function normalizeCharset(cs: string): BufferEncoding {
  const c = cs.trim().toLowerCase();
  if (c === "utf-8" || c === "utf8") return "utf8";
  if (c === "iso-8859-1" || c === "latin1" || c === "windows-1252" || c === "cp1252")
    return "latin1";
  if (c === "us-ascii" || c === "ascii") return "ascii";
  return "utf8";
}

/** Decodifica cabeceras MIME: encoded-words RFC 2047 y UTF-8 mal interpretado como Latin-1. */
function decodeMimeHeader(input: string): string {
  if (!input) return input;
  // Junta encoded-words adyacentes separados solo por espacios (regla RFC 2047)
  const collapsed = input.replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?)/g, "$1");
  let out = collapsed.replace(
    /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g,
    (_full, charset: string, enc: string, text: string) => {
      try {
        if (enc.toLowerCase() === "b") {
          return Buffer.from(text, "base64").toString(normalizeCharset(charset));
        }
        const q = text
          .replace(/_/g, " ")
          .replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) =>
            String.fromCharCode(parseInt(h, 16)),
          );
        return Buffer.from(q, "binary").toString(normalizeCharset(charset));
      } catch {
        return text;
      }
    },
  );
  // Fallback: bytes UTF-8 que llegaron decodificados como Latin-1 ("CertificaciÃ³n")
  const isLatin1Only = [...out].every((ch) => ch.charCodeAt(0) <= 0xff);
  if (isLatin1Only && /Ã[\x80-\xbf]|Â[\x80-\xbf]|â€/.test(out)) {
    try {
      const fixed = Buffer.from(out, "latin1").toString("utf8");
      if (!fixed.includes("�")) out = fixed;
    } catch {
      /* deja `out` como está */
    }
  }
  return out;
}

function parseFrom(header: string): { name: string; email: string } {
  const decoded = decodeMimeHeader(header);
  const m = decoded.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: "", email: decoded.trim() };
}

/** Restringe la query a la bandeja principal salvo que ya especifique
 *  categoría/etiqueta/ubicación (para poder buscar en Promociones, Spam, etc.). */
function scopeToPrimary(query: string): string {
  if (/\b(category:|label:|in:(anywhere|spam|trash|sent|draft|drafts))/i.test(query)) {
    return query;
  }
  return `${query} category:primary`.trim();
}

/**
 * Búsqueda genérica en Gmail: la `query` usa la sintaxis nativa de Gmail
 * (`from:`, `is:unread`, `newer_than:7d`, `has:attachment`, …) y la escribe
 * quien llama (en el chat, el modelo). Por defecto solo mira la bandeja
 * principal (excluye Promociones, Social, Notificaciones y Spam), igual que la
 * vista de Correos. Devuelve cabeceras + snippet, nunca el cuerpo completo
 * (para eso está `readEmail`).
 */
export async function searchEmails(
  params: { query: string; limit?: number },
  explicitUserId?: string,
): Promise<EmailSearchResult> {
  const userId = await resolveUserId(explicitUserId);
  const query = scopeToPrimary(params.query.trim());
  const limit = Math.min(Math.max(params.limit ?? 10, 1), 50);

  return memo(
    `gmail:search:${query}:${limit}:${userId}`,
    30_000,
    () =>
      withGoogleAuth(userId, async () => {
        const client = await getGoogleClient(userId, SCOPES.gmail);
        const gmail = google.gmail({ version: "v1", auth: client });

        const list = await gmail.users.messages.list({
          userId: "me",
          q: query,
          maxResults: limit,
        });

        const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

        const emails = await Promise.all(
          ids.map(async (id): Promise<EmailHit> => {
            const msg = await gmail.users.messages.get({
              userId: "me",
              id,
              format: "metadata",
              metadataHeaders: ["From", "Subject", "Date"],
            });
            const headers = msg.data.payload?.headers ?? [];
            const get = (n: string) =>
              headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
            const { name, email } = parseFrom(get("From"));
            const date = new Date(
              Number(msg.data.internalDate) || Date.parse(get("Date")) || Date.now(),
            );
            const labelIds = msg.data.labelIds ?? [];
            return {
              id,
              from: name || email,
              fromEmail: email,
              subject: decodeMimeHeader(get("Subject")) || "(sin asunto)",
              time: formatTime(date),
              date,
              link: `https://mail.google.com/mail/u/0/#inbox/${id}`,
              snippet: decodeMimeHeader(msg.data.snippet ?? ""),
              unread: labelIds.includes("UNREAD"),
              hasAttachments: hasAttachmentParts(msg.data.payload),
            };
          }),
        );

        emails.sort((a, b) => b.date.getTime() - a.date.getTime());

        return { emails, total: list.data.resultSizeEstimate ?? emails.length };
      }),
  );
}

export async function getUnreadEmails(
  limit = 5,
  explicitUserId?: string,
): Promise<UnreadResult> {
  // Solo la bandeja principal: excluye Promociones, Social, Notificaciones y Spam.
  const { emails, total } = await searchEmails(
    { query: "is:unread in:inbox category:primary", limit },
    explicitUserId,
  );
  return { emails, total };
}

/** Cuerpo completo de un correo, para redactar respuestas. Prefiere text/plain. */
export async function readEmail(
  id: string,
  explicitUserId?: string,
): Promise<EmailBody> {
  const userId = await resolveUserId(explicitUserId);

  return memo(
    `gmail:body:${id}:${userId}`,
    30_000,
    () =>
      withGoogleAuth(userId, async () => {
        const client = await getGoogleClient(userId, SCOPES.gmail);
        const gmail = google.gmail({ version: "v1", auth: client });

        const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
        const headers = msg.data.payload?.headers ?? [];
        const get = (n: string) =>
          headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
        const date = new Date(
          Number(msg.data.internalDate) || Date.parse(get("Date")) || Date.now(),
        );

        const raw = extractBody(msg.data.payload) || decodeMimeHeader(msg.data.snippet ?? "");
        const truncated = raw.length > BODY_LIMIT;

        return {
          id,
          from: decodeMimeHeader(get("From")),
          to: decodeMimeHeader(get("To")),
          subject: decodeMimeHeader(get("Subject")) || "(sin asunto)",
          date,
          body: truncated ? raw.slice(0, BODY_LIMIT) + "\n\n[…correo recortado]" : raw,
          truncated,
        };
      }),
  );
}

type GmailPart = {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; attachmentId?: string | null } | null;
  parts?: GmailPart[] | null;
};

function hasAttachmentParts(part?: GmailPart | null): boolean {
  if (!part) return false;
  if (part.filename && part.body?.attachmentId) return true;
  return (part.parts ?? []).some(hasAttachmentParts);
}

function decodePartData(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Recorre el árbol MIME: primero text/plain, si no hay cae a text/html limpio. */
function extractBody(part?: GmailPart | null): string {
  if (!part) return "";
  const plain = findPart(part, "text/plain");
  if (plain?.body?.data) return decodePartData(plain.body.data).trim();
  const html = findPart(part, "text/html");
  if (html?.body?.data) return stripHtml(decodePartData(html.body.data));
  return "";
}

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mime);
    if (found) return found;
  }
  return null;
}
