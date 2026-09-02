import { prisma } from "@/lib/db";
import { getTodayEvents } from "@/lib/google/calendar";
import { getUnreadEmails } from "@/lib/google/gmail";
import { getGrantedScopes, GoogleConnectionError } from "@/lib/google/client";
import { dueLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { reconnectGoogle } from "@/app/actions/auth";
import { Card, CardLink, EmptyRow, ReconnectNotice } from "@/components/ui";
import { PrioritiesList } from "@/components/cards/priorities-list";
import {
  IconGoogleCalendar,
  IconGmail,
  IconGoogleDrive,
  IconCheck,
} from "@/components/icons";

/* ---------------- Agenda de hoy ---------------- */

export async function AgendaCard() {
  let events;
  try {
    events = await getTodayEvents();
  } catch (e) {
    if (e instanceof GoogleConnectionError) {
      return (
        <Card title="Agenda de hoy">
          <ReconnectNotice tool="Google Calendar" />
        </Card>
      );
    }
    throw e;
  }

  return (
    <Card title="Agenda de hoy">
      {events.length === 0 ? (
        <EmptyRow>Sin eventos para hoy.</EmptyRow>
      ) : (
        <ul className="flex flex-col gap-1">
          {events.map((ev) => {
            return (
              <li key={ev.id}>
                <a
                  href={ev.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "-mx-2 flex gap-4 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-panel-muted",
                    ev.past && "opacity-40",
                  )}
                >
                  <span className="w-[86px] shrink-0 tabular-nums text-muted">{ev.time}</span>
                  <span className="min-w-0">{ev.title}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------------- Prioridades principales ---------------- */

export async function PrioritiesCard({ userId }: { userId: string }) {
  const tasks = await prisma.task.findMany({
    where: { userId, priority: true },
    orderBy: [{ done: "asc" }, { createdAt: "asc" }],
    take: 8,
  });
  return (
    <Card title="Prioridades principales">
      <PrioritiesList initial={tasks.map((t) => ({ id: t.id, title: t.title, done: t.done }))} />
    </Card>
  );
}

/* ---------------- Correos sin leer ---------------- */

export async function UnreadMailCard() {
  let data;
  try {
    data = await getUnreadEmails(3);
  } catch (e) {
    if (e instanceof GoogleConnectionError) {
      return (
        <Card title="Correos sin leer">
          <ReconnectNotice tool="Gmail" />
        </Card>
      );
    }
    throw e;
  }

  return (
    <Card title="Correos sin leer">
      {data.emails.length === 0 ? (
        <EmptyRow>Bandeja al día. Sin correos sin leer.</EmptyRow>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {data.emails.map((m) => (
              <li key={m.id}>
                <a
                  href={m.link}
                  target="_blank"
                  rel="noreferrer"
                  className="-mx-2 flex justify-between gap-4 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-panel-muted"
                >
                  <span className="min-w-0 flex-1 truncate">{m.from}</span>
                  <span className="shrink-0 tabular-nums text-muted">{m.time}</span>
                </a>
              </li>
            ))}
          </ul>
          <CardLink href="/correos">Ver todos ({data.total})</CardLink>
        </>
      )}
    </Card>
  );
}

/* ---------------- Tareas pendientes ---------------- */

export async function PendingTasksCard({ userId }: { userId: string }) {
  const tasks = await prisma.task.findMany({
    where: { userId, done: false, priority: false },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    take: 3,
  });

  return (
    <Card title="Tareas pendientes">
      {tasks.length === 0 ? (
        <EmptyRow>Nada pendiente. 🎉</EmptyRow>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {tasks.map((t) => (
              <li key={t.id} className="flex justify-between gap-4 text-sm">
                <span className="min-w-0 truncate">{t.title}</span>
                <span className="shrink-0 text-muted">{dueLabel(t.dueDate)}</span>
              </li>
            ))}
          </ul>
          <CardLink href="/tareas">Ver todas las tareas</CardLink>
        </>
      )}
    </Card>
  );
}

/* ---------------- Herramientas conectadas ---------------- */

const GOOGLE_TOOLS = [
  {
    label: "Google Calendar",
    Icon: IconGoogleCalendar,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
  },
  {
    label: "Gmail",
    Icon: IconGmail,
    scope: "https://www.googleapis.com/auth/gmail.readonly",
  },
  {
    label: "Google Drive",
    Icon: IconGoogleDrive,
    scope: "https://www.googleapis.com/auth/drive.metadata.readonly",
  },
];

export async function ConnectedToolsCard({ className }: { className?: string }) {
  let granted: string[] = [];
  try {
    granted = await getGrantedScopes();
  } catch {
    granted = [];
  }

  const connected = GOOGLE_TOOLS.filter((t) => granted.includes(t.scope));

  return (
    <Card title="Herramientas conectadas" className={className}>
      {connected.length === 0 ? (
        <div className="flex flex-col items-start gap-2 text-sm">
          <p className="text-muted">Ninguna herramienta con permiso concedido.</p>
          <form action={reconnectGoogle}>
            <input type="hidden" name="redirectTo" value="/" />
            <button
              type="submit"
              className="font-semibold text-accent hover:text-accent-hover"
            >
              Conectar Google
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-3.5">
          {connected.map(({ label, Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2.5 rounded-[14px] border border-border p-4 text-center sm:w-[118px]"
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-[11px] bg-panel-muted text-accent">
                <Icon size={20} />
                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-white">
                  <IconCheck size={9} />
                </span>
              </span>
              <span className="text-xs leading-tight text-muted">{label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
