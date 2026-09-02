import { APP_TZ } from "@/lib/time";
import { cn } from "@/lib/cn";

type GridEvent = {
  id: string;
  title: string;
  time: string;
  allDay: boolean;
  htmlLink: string;
  dayIndex: number;
  startHour: number;
  endHour: number;
};

const HOUR_PX = 56;
const DEFAULT_START = 7;
const DEFAULT_END = 20;

function hourLabel(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  const ap = hour < 12 ? "a. m." : "p. m.";
  let hh = hour % 12;
  if (hh === 0) hh = 12;
  return `${hh} ${ap}`;
}

export function WeekGrid({ days, events }: { days: string[]; events: GridEvent[] }) {
  const dayDates = days.map((d) => new Date(d));
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);

  // Rango de horas: por defecto 7–20, pero se amplía para cubrir cualquier evento.
  let startHour = DEFAULT_START;
  let endHour = DEFAULT_END;
  for (const e of timed) {
    startHour = Math.min(startHour, Math.floor(e.startHour));
    endHour = Math.max(endHour, Math.ceil(e.endHour));
  }
  startHour = Math.max(0, startHour);
  endHour = Math.min(24, Math.max(endHour, startHour + 6));

  const slots = endHour - startHour;
  const hours = Array.from({ length: slots }, (_, i) => startHour + i);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] overflow-hidden rounded-2xl border border-border bg-card">
        {/* Cabecera de días */}
        <div className="flex border-b border-border">
          <div className="w-16 shrink-0" />
          {dayDates.map((d, i) => {
            const key = new Intl.DateTimeFormat("en-CA", {
              timeZone: APP_TZ,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(d);
            const isToday = key === todayKey;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 border-l border-[#eef3f0] px-1 py-2.5 text-center",
                  isToday ? "bg-[#f1fbf4] text-accent" : "text-muted",
                )}
              >
                <div className="text-[11px] uppercase tracking-wide">
                  {new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: APP_TZ })
                    .format(d)
                    .replace(".", "")}
                </div>
                <div className="mt-0.5 text-base font-semibold">
                  {new Intl.DateTimeFormat("es-MX", { day: "numeric", timeZone: APP_TZ }).format(d)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Franja de eventos de todo el día */}
        {allDay.length > 0 && (
          <div className="flex border-b border-[#eef3f0]">
            <div className="w-16 shrink-0 py-1.5 pr-2 text-right text-[10px] text-muted">
              Todo el día
            </div>
            {dayDates.map((_, i) => (
              <div key={i} className="flex-1 border-l border-[#eef3f0] p-1">
                {allDay
                  .filter((e) => e.dayIndex === i)
                  .map((e) => (
                    <a
                      key={e.id}
                      href={e.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-1 block truncate rounded-md border-l-[3px] border-accent bg-accent-soft px-1.5 py-1 text-[11px] text-accent-ink hover:brightness-95"
                    >
                      {e.title}
                    </a>
                  ))}
              </div>
            ))}
          </div>
        )}

        {/* Cuerpo con horas */}
        <div className="flex" style={{ height: slots * HOUR_PX }}>
          <div className="w-16 shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="pr-2 pt-0.5 text-right text-[10.5px] text-muted"
                style={{ height: HOUR_PX }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>

          {dayDates.map((_, dayIdx) => (
            <div
              key={dayIdx}
              className="relative flex-1 border-l border-[#eef3f0]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent, transparent 55px, #eef3f0 55px, #eef3f0 56px)",
              }}
            >
              {timed
                .filter((e) => e.dayIndex === dayIdx)
                .map((e) => {
                  const s = Math.max(e.startHour, startHour);
                  const en = Math.min(Math.max(e.endHour, e.startHour + 0.5), endHour);
                  const top = (s - startHour) * HOUR_PX + 3;
                  const height = Math.max((en - s) * HOUR_PX - 6, 18);
                  return (
                    <a
                      key={e.id}
                      href={e.htmlLink}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute inset-x-1 block overflow-hidden rounded-lg border-l-[3px] border-accent bg-accent-soft px-1.5 py-1 transition hover:brightness-95"
                      style={{ top, height }}
                    >
                      <div className="text-[11px] font-semibold leading-tight text-accent-ink">
                        {e.title}
                      </div>
                      <div className="mt-px text-[10px] text-accent-ink/80">{e.time}</div>
                    </a>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
