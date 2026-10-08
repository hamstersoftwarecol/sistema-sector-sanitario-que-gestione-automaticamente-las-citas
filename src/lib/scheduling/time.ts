import { TZDate } from "@date-fns/tz";

export const DEFAULT_TIMEZONE = "America/Bogota";

export const SUPPORTED_TIMEZONES = [
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "America/Guayaquil",
  "America/Caracas",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Panama",
  "America/Costa_Rica",
  "America/Guatemala",
  "America/Santo_Domingo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
] as const;

export const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string) {
  if (!DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Instante UTC que corresponde a `minuteOfDay` del día `dateKey` (YYYY-MM-DD) en la zona dada. */
export function zonedDateTime(dateKey: string, minuteOfDay: number, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(new TZDate(y!, m! - 1, d!, 0, minuteOfDay, timeZone).getTime());
}

/** Fecha local (YYYY-MM-DD) de un instante en la zona dada. */
export function toDateKey(date: Date, timeZone: string): string {
  const local = new TZDate(date.getTime(), timeZone);
  return [
    local.getFullYear(),
    String(local.getMonth() + 1).padStart(2, "0"),
    String(local.getDate()).padStart(2, "0"),
  ].join("-");
}

export function minuteOfDayIn(date: Date, timeZone: string) {
  const local = new TZDate(date.getTime(), timeZone);
  return local.getHours() * 60 + local.getMinutes();
}

/** Día de la semana (0 = domingo) de una fecha de calendario. */
export function dayOfWeekOfKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

export function addDaysToKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + days));
  return date.toISOString().slice(0, 10);
}

export function diffInDays(fromKey: string, toKey: string) {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** Lunes de la semana a la que pertenece `dateKey`. */
export function startOfWeekKey(dateKey: string) {
  const dow = dayOfWeekOfKey(dateKey);
  return addDaysToKey(dateKey, dow === 0 ? -6 : 1 - dow);
}

export function monthRangeKeys(dateKey: string) {
  const [y, m] = dateKey.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(y!, m!, 1)).toISOString().slice(0, 10);
  return { first, next };
}

export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return NaN;
  return hours * 60 + minutes;
}

const LOCALE = "es-CO";

export function formatDateTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDate(date: Date, timeZone: string, style: "long" | "short" = "long") {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    ...(style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { weekday: "short", day: "numeric", month: "short" }),
  }).format(date);
}

export function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Formatea una fecha de calendario (YYYY-MM-DD) sin depender de la zona horaria. */
export function formatDateKey(dateKey: string, style: "long" | "short" = "long") {
  return formatDate(new Date(`${dateKey}T12:00:00Z`), "UTC", style);
}
