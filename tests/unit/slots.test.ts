import { describe, expect, it } from "vitest";
import { generateSlots, validateRules } from "@/lib/scheduling/slots";
import { zonedDateTime } from "@/lib/scheduling/time";

const TZ = "America/Bogota";
// Lunes 7 de enero de 2030.
const MONDAY = "2030-01-07";
const NOW = new Date("2030-01-01T00:00:00Z");

const at = (dateKey: string, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return zonedDateTime(dateKey, h! * 60 + m!, TZ);
};

describe("generateSlots", () => {
  const morning = [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 11 * 60 }];

  it("divide cada franja en huecos de la duración configurada", () => {
    const slots = generateSlots({ rules: morning, timeZone: TZ, slotMinutes: 30, fromDateKey: MONDAY, toDateKey: MONDAY, busy: [], now: NOW });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      "2030-01-07T14:00:00.000Z",
      "2030-01-07T14:30:00.000Z",
      "2030-01-07T15:00:00.000Z",
      "2030-01-07T15:30:00.000Z",
    ]);
    expect(slots[0]!.endsAt.toISOString()).toBe("2030-01-07T14:30:00.000Z");
  });

  it("no genera huecos que no caben completos en la franja", () => {
    const slots = generateSlots({ rules: morning, timeZone: TZ, slotMinutes: 45, fromDateKey: MONDAY, toDateKey: MONDAY, busy: [], now: NOW });
    expect(slots).toHaveLength(2); // 09:00 y 09:45; 10:30 terminaría a las 11:15
  });

  it("excluye huecos ocupados por citas o bloqueos", () => {
    const busy = [
      { startsAt: at(MONDAY, "09:30"), endsAt: at(MONDAY, "10:00") },
      { startsAt: at(MONDAY, "10:15"), endsAt: at(MONDAY, "10:20") }, // solapa parcialmente con 10:00–10:30
    ];
    const slots = generateSlots({ rules: morning, timeZone: TZ, slotMinutes: 30, fromDateKey: MONDAY, toDateKey: MONDAY, busy, now: NOW });
    expect(slots.map((s) => s.startsAt.getTime())).toEqual([at(MONDAY, "09:00").getTime(), at(MONDAY, "10:30").getTime()]);
  });

  it("respeta la antelación mínima respecto a ahora", () => {
    const now = at(MONDAY, "08:45");
    const slots = generateSlots({ rules: morning, timeZone: TZ, slotMinutes: 30, fromDateKey: MONDAY, toDateKey: MONDAY, busy: [], now, minLeadMinutes: 60 });
    expect(slots[0]!.startsAt.getTime()).toBe(at(MONDAY, "10:00").getTime());
  });

  it("solo usa las reglas del día de la semana correspondiente", () => {
    const rules = [
      { dayOfWeek: 1, startMinute: 9 * 60, endMinute: 10 * 60 },
      { dayOfWeek: 3, startMinute: 15 * 60, endMinute: 16 * 60 },
    ];
    const slots = generateSlots({ rules, timeZone: TZ, slotMinutes: 60, fromDateKey: MONDAY, toDateKey: "2030-01-13", busy: [], now: NOW });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(["2030-01-07T14:00:00.000Z", "2030-01-09T20:00:00.000Z"]);
  });

  it("devuelve vacío para rangos inválidos o demasiado largos", () => {
    expect(generateSlots({ rules: morning, timeZone: TZ, slotMinutes: 30, fromDateKey: MONDAY, toDateKey: "2030-01-01", busy: [], now: NOW })).toEqual([]);
    expect(generateSlots({ rules: morning, timeZone: TZ, slotMinutes: 30, fromDateKey: MONDAY, toDateKey: "2031-01-01", busy: [], now: NOW })).toEqual([]);
  });
});

describe("validateRules", () => {
  it("acepta franjas válidas", () => {
    expect(validateRules([{ dayOfWeek: 1, startMinute: 480, endMinute: 720 }, { dayOfWeek: 1, startMinute: 840, endMinute: 1080 }])).toBeNull();
  });

  it("rechaza franjas solapadas o invertidas", () => {
    expect(validateRules([{ dayOfWeek: 1, startMinute: 480, endMinute: 720 }, { dayOfWeek: 1, startMinute: 700, endMinute: 900 }])).toMatch(/solapan/);
    expect(validateRules([{ dayOfWeek: 2, startMinute: 600, endMinute: 540 }])).toMatch(/posterior/);
  });
});
