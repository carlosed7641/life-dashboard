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

export async function getUnreadEmails(
  limit = 5,
  explicitUserId?: string,
): Promise<UnreadResult> {
  const userId = await resolveUserId(explicitUserId);
  return memo(`gmail:unread:${limit}:${userId}`, 30_000, () => withGoogleAuth(userId, async () => {
    const client = await getGoogleClient(userId, SCOPES.gmail);
    const gmail = google.gmail({ version: "v1", auth: client });

    // Solo la bandeja principal: excluye Promociones, Social, Notificaciones y Spam.
    const query = "is:unread in:inbox category:primary";

    const list = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: limit,
    });

    const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

    const emails = await Promise.all(
      ids.map(async (id): Promise<UnreadEmail> => {
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
        const date = new Date(Number(msg.data.internalDate) || Date.parse(get("Date")) || Date.now());
        return {
          id,
          from: name || email,
          fromEmail: email,
          subject: decodeMimeHeader(get("Subject")) || "(sin asunto)",
          time: formatTime(date),
          date,
          link: `https://mail.google.com/mail/u/0/#inbox/${id}`,
        };
      }),
    );

    emails.sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      emails,
      total: list.data.resultSizeEstimate ?? emails.length,
    };
  }));
}
