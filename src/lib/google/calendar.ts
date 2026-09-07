import { google } from "googleapis";
import { getGoogleClient, resolveUserId, SCOPES, withGoogleAuth } from "./client";
import { memo } from "@/lib/memo";
import { formatTime } from "@/lib/format";
import { APP_TZ, zonedDayRange, zonedWeekRange } from "@/lib/time";

export type AgendaEvent = {
  id: string;
  title: string;
  time: string; // "9:00 a. m." o "Todo el día"
  allDay: boolean;
  start: Date;
  end: Date;
  past: boolean; // el evento ya terminó (al momento de la consulta)
  htmlLink: string; // URL del evento en Google Calendar
};

export type WeekEvent = AgendaEvent & {
  dayIndex: number; // 0 = lunes .. 6 = domingo
  startHour: number; // hora decimal, p. ej. 10.5
  endHour: number;
};

export type DetailedEvent = AgendaEvent & {
  description: string | null;
  location: string | null;
  attendees: string[]; // correos de los invitados
  recurring: boolean; // pertenece a una serie recurrente
};

function toDate(v?: string | null): Date | null {
  return v ? new Date(v) : null;
}

export async function getTodayEvents(explicitUserId?: string): Promise<AgendaEvent[]> {
  const userId = await resolveUserId(explicitUserId);
  return memo(`cal:today:${userId}`, 30_000, () => withGoogleAuth(userId, async () => {
    const client = await getGoogleClient(userId, SCOPES.calendar);
    const cal = google.calendar({ version: "v3", auth: client });
    const { start, end } = zonedDayRange();

    const res = await cal.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 25,
    });

    return (res.data.items ?? [])
      .map((e): AgendaEvent | null => {
        const startDate = toDate(e.start?.dateTime) ?? toDate(e.start?.date);
        const endDate = toDate(e.end?.dateTime) ?? toDate(e.end?.date) ?? startDate;
        if (!startDate || !endDate) return null;
        const allDay = !e.start?.dateTime;
        return {
          id: e.id ?? cryptoId(),
          title: e.summary ?? "(sin título)",
          time: allDay ? "Todo el día" : formatTime(startDate),
          allDay,
          start: startDate,
          end: endDate,
          past: !allDay && endDate.getTime() <= Date.now(),
          htmlLink: e.htmlLink ?? "https://calendar.google.com/",
        };
      })
      .filter((x): x is AgendaEvent => x !== null)
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime());
  }));
}

export async function getWeekEvents(
  weekOffset = 0,
  explicitUserId?: string,
): Promise<{ days: Date[]; events: WeekEvent[] }> {
  const userId = await resolveUserId(explicitUserId);
  return memo(`cal:week:${weekOffset}:${userId}`, 30_000, () => withGoogleAuth(userId, async () => {
    const client = await getGoogleClient(userId, SCOPES.calendar);
    const cal = google.calendar({ version: "v3", auth: client });
    const { start, end, days } = zonedWeekRange(APP_TZ, weekOffset);

    const res = await cal.events.list({
      calendarId: "primary",
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    const wallParts = (d: Date) => {
      const s = new Intl.DateTimeFormat("en-CA", {
        timeZone: APP_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
      // "2026-09-01, 13:45"
      const [date, time] = s.split(", ");
      const [h, m] = time.split(":").map(Number);
      return { date, hour: h + m / 60 };
    };
    const dayKeys = days.map(
      (d) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: APP_TZ,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(d),
    );

    const events = (res.data.items ?? [])
      .map((e): WeekEvent | null => {
        const startDate = toDate(e.start?.dateTime) ?? toDate(e.start?.date);
        const endDate = toDate(e.end?.dateTime) ?? toDate(e.end?.date) ?? startDate;
        if (!startDate || !endDate) return null;
        const allDay = !e.start?.dateTime;
        const sp = wallParts(startDate);
        const ep = wallParts(endDate);
        const dayIndex = dayKeys.indexOf(sp.date);
        if (dayIndex === -1) return null;
        return {
          id: e.id ?? cryptoId(),
          title: e.summary ?? "(sin título)",
          time: allDay ? "Todo el día" : formatTime(startDate),
          allDay,
          start: startDate,
          end: endDate,
          past: !allDay && endDate.getTime() <= Date.now(),
          htmlLink: e.htmlLink ?? "https://calendar.google.com/",
          dayIndex,
          startHour: allDay ? 0 : sp.hour,
          endHour: allDay ? 24 : ep.date === sp.date ? ep.hour : 24,
        };
      })
      .filter((x): x is WeekEvent => x !== null);

    return { days, events };
  }));
}

/**
 * Eventos en un rango arbitrario, con descripción, ubicación e invitados.
 * Para el chat: `from`/`to` son ISO (los resuelve el modelo con la fecha actual
 * inyectada en el prompt, en zona America/Bogota).
 */
export async function listEvents(
  params: { from: string; to: string; limit?: number },
  explicitUserId?: string,
): Promise<DetailedEvent[]> {
  const userId = await resolveUserId(explicitUserId);
  const from = new Date(params.from);
  const to = new Date(params.to);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 250);

  return memo(
    `cal:list:${from.toISOString()}:${to.toISOString()}:${limit}:${userId}`,
    30_000,
    () =>
      withGoogleAuth(userId, async () => {
        const client = await getGoogleClient(userId, SCOPES.calendar);
        const cal = google.calendar({ version: "v3", auth: client });

        const res = await cal.events.list({
          calendarId: "primary",
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: limit,
        });

        return (res.data.items ?? [])
          .map((e): DetailedEvent | null => {
            const startDate = toDate(e.start?.dateTime) ?? toDate(e.start?.date);
            const endDate = toDate(e.end?.dateTime) ?? toDate(e.end?.date) ?? startDate;
            if (!startDate || !endDate) return null;
            const allDay = !e.start?.dateTime;
            return {
              id: e.id ?? cryptoId(),
              title: e.summary ?? "(sin título)",
              time: allDay ? "Todo el día" : formatTime(startDate),
              allDay,
              start: startDate,
              end: endDate,
              past: !allDay && endDate.getTime() <= Date.now(),
              htmlLink: e.htmlLink ?? "https://calendar.google.com/",
              description: e.description?.trim() || null,
              location: e.location?.trim() || null,
              attendees: (e.attendees ?? [])
                .map((a) => a.email ?? "")
                .filter(Boolean),
              recurring: Boolean(e.recurringEventId),
            };
          })
          .filter((x): x is DetailedEvent => x !== null)
          .sort(
            (a, b) =>
              Number(b.allDay) - Number(a.allDay) || a.start.getTime() - b.start.getTime(),
          );
      }),
  );
}

function cryptoId() {
  return Math.random().toString(36).slice(2);
}
