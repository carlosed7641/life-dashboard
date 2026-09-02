import { getUnreadEmails } from "@/lib/google/gmail";
import { GoogleConnectionError } from "@/lib/google/client";
import { ReconnectNotice } from "@/components/ui";
import { formatShortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CorreosPage() {
  let data;
  try {
    data = await getUnreadEmails(30);
  } catch (e) {
    if (e instanceof GoogleConnectionError) {
      return (
        <div className="mx-auto max-w-3xl p-5 md:p-10">
          <h1 className="mb-5 font-display text-2xl font-semibold">Correos sin leer</h1>
          <ReconnectNotice tool="Gmail" callbackPath="/correos" />
        </div>
      );
    }
    throw e;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 p-5 md:p-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-semibold">Correos sin leer</h1>
        <span className="text-sm text-muted">{data.total} en la bandeja</span>
      </div>

      {data.emails.length === 0 ? (
        <p className="text-sm text-muted">Bandeja al día.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {data.emails.map((m) => (
            <li key={m.id}>
              <a
                href={m.link}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-1 px-4 py-3.5 transition-colors hover:bg-panel-muted"
              >
                <div className="flex justify-between gap-4 text-sm">
                  <span className="truncate font-medium">{m.from}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {m.time} · {formatShortDate(m.date)}
                  </span>
                </div>
                <span className="truncate text-[13px] text-muted">{m.subject}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
