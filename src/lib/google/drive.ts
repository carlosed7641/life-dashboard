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
