import { getRecentFiles } from "@/lib/google/drive";
import { GoogleConnectionError } from "@/lib/google/client";
import { ReconnectNotice } from "@/components/ui";
import { relativeTime } from "@/lib/format";
import { FILE_ICON, IconExternal } from "@/components/icons";
import { cn } from "@/lib/cn";

const ICON_TONE: Record<string, string> = {
  image: "bg-emerald-50 text-emerald-600",
  video: "bg-rose-50 text-rose-600",
  audio: "bg-violet-50 text-violet-600",
  pdf: "bg-red-50 text-red-600",
  spreadsheet: "bg-green-50 text-green-700",
  presentation: "bg-amber-50 text-amber-600",
  document: "bg-sky-50 text-sky-600",
  folder: "bg-slate-100 text-slate-600",
  archive: "bg-orange-50 text-orange-600",
  code: "bg-zinc-100 text-zinc-700",
  file: "bg-panel-muted text-accent",
};

export const dynamic = "force-dynamic";

export default async function ArchivosPage() {
  let files;
  try {
    files = await getRecentFiles(30);
  } catch (e) {
    if (e instanceof GoogleConnectionError) {
      return (
        <div className="mx-auto max-w-3xl p-5 md:p-10">
          <h1 className="mb-5 font-display text-2xl font-semibold">Archivos recientes</h1>
          <ReconnectNotice tool="Google Drive" callbackPath="/archivos" />
        </div>
      );
    }
    throw e;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-5 md:p-10">
      <h1 className="font-display text-2xl font-semibold">Archivos recientes</h1>

      {files.length === 0 ? (
        <p className="text-sm text-muted">Sin archivos recientes en Drive.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {files.map((f) => {
            const Icon = FILE_ICON[f.category];
            return (
              <li key={f.id}>
                <a
                  href={f.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-panel-muted"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                      ICON_TONE[f.category] ?? ICON_TONE.file,
                    )}
                  >
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted">
                      {f.kind} · visto {relativeTime(f.viewedTime)}
                    </div>
                  </div>
                  <IconExternal size={15} className="shrink-0 text-muted" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
