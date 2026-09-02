export const APP_TZ = process.env.APP_TZ || "America/Bogota";

/** Milisegundos que hay que sumar a un instante UTC para obtener la hora de pared en `tz`. */
function tzOffsetMs(instant: Date, tz: string): number {
  const local = new Date(instant.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(instant.toLocaleString("en-US", { timeZone: "UTC" }));
  return local.getTime() - utc.getTime();
}

/** Clave de fecha "YYYY-MM-DD" del día actual en la zona de la app. */
export function todayKey(tz: string = APP_TZ, base: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

/** Rango [inicio, fin) del día actual (en `tz`) expresado como instantes UTC. */
export function zonedDayRange(tz: string = APP_TZ, dayOffset = 0): { start: Date; end: Date } {
  const now = new Date();
  const key = todayKey(tz, now);
  const midnightUTC = new Date(`${key}T00:00:00Z`);
  const offset = tzOffsetMs(midnightUTC, tz);
  const start = new Date(midnightUTC.getTime() - offset + dayOffset * 86_400_000);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/** Rango [lunes, lunes+7) de la semana actual (+ `weekOffset` semanas), en `tz`, como UTC. */
export function zonedWeekRange(
  tz: string = APP_TZ,
  weekOffset = 0,
): { start: Date; end: Date; days: Date[] } {
  const { start: todayStart } = zonedDayRange(tz);
  // getDay() sobre la hora de pared: 0 = domingo .. 6 = sábado
  const wall = new Date(todayStart.toLocaleString("en-US", { timeZone: tz }));
  const mondayShift = (wall.getDay() + 6) % 7;
  const start = new Date(todayStart.getTime() - mondayShift * 86_400_000 + weekOffset * 7 * 86_400_000);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86_400_000));
  return { start, end, days };
}
