import { APP_TZ } from "./time";

/** "9:00 a. m." — con el formato de la maqueta. */
export function formatTime(d: Date, tz: string = APP_TZ): string {
  const s = new Intl.DateTimeFormat("es-MX", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  }).format(d);
  return s
    .replace(/ /g, " ")
    .replace(/\s*a\.?\s?m\.?/i, " a. m.")
    .replace(/\s*p\.?\s?m\.?/i, " p. m.")
    .trim();
}

/** Saludo según la hora del día en la zona de la app. */
export function greeting(tz: string = APP_TZ): {
  text: string;
  part: "morning" | "afternoon" | "night";
} {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      hourCycle: "h23",
      timeZone: tz,
    }).format(new Date()),
  );
  if (hour >= 5 && hour < 12) return { text: "Buenos días", part: "morning" };
  if (hour >= 12 && hour < 19) return { text: "Buenas tardes", part: "afternoon" };
  return { text: "Buenas noches", part: "night" };
}

/** "Lunes, 1 de septiembre de 2026" */
export function formatLongDate(d: Date, tz: string = APP_TZ): string {
  const s = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "1 sep" / "24 may" */
export function formatShortDate(d: Date, tz: string = APP_TZ): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: tz,
  })
    .format(d)
    .replace(".", "");
}

/**
 * Convierte un valor de fecha en `Date`. Para valores "solo día" ("YYYY-MM-DD"),
 * ancla al mediodía UTC para que caiga en el día correcto en cualquier zona
 * horaria razonable (evita el desfase de -1 día en zonas al oeste de UTC).
 */
export function parseDay(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00.000Z`);
  return new Date(value);
}

/** Etiqueta relativa para vencimientos: "Hoy" · "Mañana" · "Ayer" · "1 sep". */
export function dueLabel(due: Date | null, tz: string = APP_TZ): string {
  if (!due) return "";
  const key = (x: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const k = key(due);
  if (k === key(today)) return "Hoy";
  if (k === key(tomorrow)) return "Mañana";
  if (k === key(yesterday)) return "Ayer";
  return formatShortDate(due, tz);
}

/** "hace un momento" · "hace 5 min" · "hace 2 h" · "ayer" · "24 may" */
export function relativeTime(d: Date, tz: string = APP_TZ): string {
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return formatShortDate(d, tz);
}
