import Link from "next/link";
import { getWeekEvents } from "@/lib/google/calendar";
import { GoogleConnectionError } from "@/lib/google/client";
import { APP_TZ } from "@/lib/time";
import { ReconnectNotice } from "@/components/ui";
import { WeekGrid } from "@/components/calendar/week-grid";
import { IconChevronLeft, IconChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const weekOffset = Number.parseInt(w ?? "0", 10) || 0;

  let data: Awaited<ReturnType<typeof getWeekEvents>> | null = null;
  let failed = false;
  try {
    data = await getWeekEvents(weekOffset);
  } catch (e) {
    if (e instanceof GoogleConnectionError) failed = true;
    else throw e;
  }

  const days = data?.days ?? [];
  const monthLabel = days.length
    ? new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: APP_TZ })
        .format(days[3])
        .replace(/^\w/, (c) => c.toUpperCase())
    : "";
  const rangeLabel = days.length
    ? `Semana del ${new Intl.DateTimeFormat("es-MX", { day: "numeric", timeZone: APP_TZ }).format(days[0])} – ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: APP_TZ }).format(days[6]).replace(".", "")}`
    : "";

  return (
    <div className="flex flex-col gap-5 p-5 md:p-9">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{monthLabel}</h1>
          <p className="mt-1.5 text-sm text-muted">{rangeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex overflow-hidden rounded-[9px] border border-border bg-card">
            <Link
              href={`/calendario?w=${weekOffset - 1}`}
              className="border-r border-border px-2.5 py-2 text-muted hover:bg-panel-muted"
              aria-label="Semana anterior"
            >
              <IconChevronLeft size={15} />
            </Link>
            <Link
              href={`/calendario?w=${weekOffset + 1}`}
              className="px-2.5 py-2 text-muted hover:bg-panel-muted"
              aria-label="Semana siguiente"
            >
              <IconChevronRight size={15} />
            </Link>
          </div>
          <Link
            href="/calendario"
            className="rounded-[9px] border border-border bg-card px-3.5 py-2 text-[13px] hover:bg-panel-muted"
          >
            Hoy
          </Link>
          <div className="flex overflow-hidden rounded-[9px] border border-border bg-card text-[13px]">
            <span className="px-3 py-2 text-[#8a9e94]">Día</span>
            <span className="bg-accent px-3 py-2 font-semibold text-white">Semana</span>
            <span className="px-3 py-2 text-[#8a9e94]">Mes</span>
          </div>
        </div>
      </header>

      {failed ? (
        <ReconnectNotice tool="Google Calendar" callbackPath="/calendario" />
      ) : (
        <WeekGrid
          days={days.map((d) => d.toISOString())}
          events={(data?.events ?? []).map((e) => ({
            id: e.id,
            title: e.title,
            time: e.time,
            allDay: e.allDay,
            htmlLink: e.htmlLink,
            dayIndex: e.dayIndex,
            startHour: e.startHour,
            endHour: e.endHour,
          }))}
        />
      )}
    </div>
  );
}
