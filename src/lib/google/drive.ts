import { google } from "googleapis";
import { getGoogleClient, resolveUserId, SCOPES, withGoogleAuth } from "./client";
import { memo } from "@/lib/memo";

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "folder"
  | "archive"
  | "code"
  | "file";

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  category: FileCategory;
  kind: string; // etiqueta legible en español
  webViewLink: string;
  viewedTime: Date; // última vez que el usuario lo abrió
};

export type DriveFileFull = DriveFile & {
  sizeBytes: number | null; // null en Docs/Sheets/Slides nativos: no reportan tamaño
  modifiedTime: Date;
  createdTime: Date | null;
};

const LABEL: Record<FileCategory, string> = {
  image: "Imagen",
  video: "Vídeo",
  audio: "Audio",
  pdf: "PDF",
  document: "Documento",
  spreadsheet: "Hoja de cálculo",
  presentation: "Presentación",
  folder: "Carpeta",
  archive: "Comprimido",
  code: "Código",
  file: "Archivo",
};

const MIME_CATEGORY: Record<string, FileCategory> = {
  "application/vnd.google-apps.document": "document",
  "application/vnd.google-apps.spreadsheet": "spreadsheet",
  "application/vnd.google-apps.presentation": "presentation",
  "application/vnd.google-apps.folder": "folder",
  "application/pdf": "pdf",
};

const EXT_CATEGORY: Record<string, FileCategory> = {
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  avif: "image", bmp: "image", svg: "image", heic: "image", tiff: "image",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video", m4v: "video",
  mp3: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio", m4a: "audio",
  pdf: "pdf",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
  doc: "document", docx: "document", txt: "document", md: "document", rtf: "document", pages: "document",
  xls: "spreadsheet", xlsx: "spreadsheet", csv: "spreadsheet", numbers: "spreadsheet",
  ppt: "presentation", pptx: "presentation", key: "presentation",
  js: "code", ts: "code", tsx: "code", jsx: "code", json: "code", html: "code",
  css: "code", py: "code", rb: "code", go: "code", rs: "code", java: "code",
  c: "code", cpp: "code", sh: "code", sql: "code", yml: "code", yaml: "code",
};

function categoryOf(mime: string, name: string): FileCategory {
  if (MIME_CATEGORY[mime]) return MIME_CATEGORY[mime];
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return EXT_CATEGORY[ext] ?? "file";
}

export async function getRecentFiles(
  limit = 5,
  explicitUserId?: string,
): Promise<DriveFile[]> {
  const userId = await resolveUserId(explicitUserId);
  return memo(`drive:recent:${limit}:${userId}`, 30_000, () => withGoogleAuth(userId, async () => {
    const client = await getGoogleClient(userId, SCOPES.drive);
    const drive = google.drive({ version: "v3", auth: client });

    const res = await drive.files.list({
      orderBy: "viewedByMeTime desc",
      pageSize: Math.min(limit * 3, 100),
      q: "trashed = false",
      fields: "files(id, name, mimeType, webViewLink, viewedByMeTime, modifiedTime)",
      spaces: "drive",
    });

    return (res.data.files ?? [])
      .filter((f) => f.viewedByMeTime) // solo los que el usuario ha abierto
      .slice(0, limit)
      .map((f) => {
        const name = f.name ?? "(sin nombre)";
        const mimeType = f.mimeType ?? "";
        const category = categoryOf(mimeType, name);
        return {
          id: f.id ?? "",
          name,
          mimeType,
          category,
          kind: LABEL[category],
          webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
          viewedTime: new Date(f.viewedByMeTime!),
        };
      });
  }));
}

/**
 * Listado general de Drive para el chat: acepta una query `q` de Drive (la escribe
 * el modelo) y devuelve el tamaño de cada archivo. La API de Drive NO permite
 * filtrar por tamaño en `q`, así que se pagina y el filtrado por bytes se hace
 * en quien consume esto. `truncated` avisa si se alcanzó `maxFiles`.
 *
 * Por defecto solo incluye archivos DE TU PROPIEDAD (`'me' in owners`), no los
 * que otras personas han compartido contigo. Pasa `includeShared: true` para
 * incluirlos.
 */
export async function listFiles(
  params: { q?: string; orderBy?: string; maxFiles?: number; includeShared?: boolean } = {},
  explicitUserId?: string,
): Promise<{ files: DriveFileFull[]; truncated: boolean }> {
  const userId = await resolveUserId(explicitUserId);
  const base = params.q?.trim() || "trashed = false";
  const q =
    params.includeShared || /\bowners\b/.test(base) ? base : `${base} and 'me' in owners`;
  const orderBy = params.orderBy?.trim() || "modifiedTime desc";
  const maxFiles = Math.min(Math.max(params.maxFiles ?? 2000, 1), 5000);

  return memo(
    `drive:list:${q}:${orderBy}:${maxFiles}:${userId}`,
    30_000,
    () =>
      withGoogleAuth(userId, async () => {
        const client = await getGoogleClient(userId, SCOPES.drive);
        const drive = google.drive({ version: "v3", auth: client });

        const out: DriveFileFull[] = [];
        let pageToken: string | undefined;
        let truncated = false;

        do {
          const res = await drive.files.list({
            orderBy,
            q,
            pageSize: 1000,
            pageToken,
            fields:
              "nextPageToken, files(id, name, mimeType, size, webViewLink, viewedByMeTime, modifiedTime, createdTime)",
            spaces: "drive",
          });

          for (const f of res.data.files ?? []) {
            const name = f.name ?? "(sin nombre)";
            const mimeType = f.mimeType ?? "";
            const category = categoryOf(mimeType, name);
            const modified = f.modifiedTime ? new Date(f.modifiedTime) : new Date(0);
            out.push({
              id: f.id ?? "",
              name,
              mimeType,
              category,
              kind: LABEL[category],
              webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
              viewedTime: f.viewedByMeTime ? new Date(f.viewedByMeTime) : modified,
              sizeBytes: f.size ? Number(f.size) : null,
              modifiedTime: modified,
              createdTime: f.createdTime ? new Date(f.createdTime) : null,
            });
            if (out.length >= maxFiles) {
              truncated = Boolean(res.data.nextPageToken);
              break;
            }
          }

          pageToken = out.length >= maxFiles ? undefined : res.data.nextPageToken ?? undefined;
        } while (pageToken);

        return { files: out, truncated };
      }),
  );
}
