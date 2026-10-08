import { dayOfWeekOfKey, addDaysToKey, diffInDays, zonedDateTime } from "./time";

export type WeeklyRule = { dayOfWeek: number; startMinute: number; endMinute: number };
export type TimeRange = { startsAt: Date; endsAt: Date };
export type Slot = TimeRange;

export type GenerateSlotsInput = {
  rules: WeeklyRule[];
  timeZone: string;
  slotMinutes: number;
  /** Primer y último día (inclusive) en la zona horaria del médico. */
  fromDateKey: string;
  toDateKey: string;
  /** Citas activas y bloqueos (vacaciones, etc.). */
  busy: TimeRange[];
  now: Date;
  /** Antelación mínima para reservar. */
  minLeadMinutes?: number;
};

export const MAX_RANGE_DAYS = 62;

function overlaps(a: TimeRange, b: TimeRange) {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

/**
 * Genera los huecos libres de un médico a partir de su horario semanal.
 * Función pura: no toca la base de datos, por eso es fácil de probar.
 */
export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const { rules, timeZone, slotMinutes, fromDateKey, toDateKey, busy, now } = input;
  const earliest = new Date(now.getTime() + (input.minLeadMinutes ?? 60) * 60_000);
  const days = diffInDays(fromDateKey, toDateKey);
  if (slotMinutes <= 0 || days < 0 || days > MAX_RANGE_DAYS) return [];

  const seen = new Set<number>();
  const slots: Slot[] = [];

  for (let offset = 0; offset <= days; offset++) {
    const dateKey = addDaysToKey(fromDateKey, offset);
    const dow = dayOfWeekOfKey(dateKey);

    for (const rule of rules) {
      if (rule.dayOfWeek !== dow) continue;
      for (let minute = rule.startMinute; minute + slotMinutes <= rule.endMinute; minute += slotMinutes) {
        const slot = {
          startsAt: zonedDateTime(dateKey, minute, timeZone),
          endsAt: zonedDateTime(dateKey, minute + slotMinutes, timeZone),
        };
        const key = slot.startsAt.getTime();
        if (seen.has(key) || slot.startsAt < earliest) continue;
        if (busy.some((range) => overlaps(slot, range))) continue;
        seen.add(key);
        slots.push(slot);
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Valida que las franjas de un día no se solapen y estén dentro de 00:00–24:00. */
export function validateRules(rules: WeeklyRule[]): string | null {
  for (const rule of rules) {
    if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) return "Día de la semana inválido.";
    if (rule.startMinute < 0 || rule.endMinute > 24 * 60) return "Horario fuera del día.";
    if (rule.endMinute <= rule.startMinute) return "La hora de fin debe ser posterior a la de inicio.";
  }
  for (let day = 0; day <= 6; day++) {
    const sorted = rules
      .filter((rule) => rule.dayOfWeek === day)
      .sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.startMinute < sorted[i - 1]!.endMinute) {
        return "Hay franjas que se solapan en el mismo día.";
      }
    }
  }
  return null;
}
