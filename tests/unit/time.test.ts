import { describe, expect, it } from "vitest";
import {
  addDaysToKey,
  dayOfWeekOfKey,
  diffInDays,
  isDateKey,
  minutesToTime,
  monthRangeKeys,
  startOfWeekKey,
  timeToMinutes,
  toDateKey,
  zonedDateTime,
} from "@/lib/scheduling/time";

describe("time helpers", () => {
  it("convierte una hora local a UTC según la zona", () => {
    expect(zonedDateTime("2030-01-07", 9 * 60, "America/Bogota").toISOString()).toBe("2030-01-07T14:00:00.000Z");
    expect(zonedDateTime("2030-07-01", 9 * 60, "Europe/Madrid").toISOString()).toBe("2030-07-01T07:00:00.000Z");
    expect(zonedDateTime("2030-01-01", 9 * 60, "Europe/Madrid").toISOString()).toBe("2030-01-01T08:00:00.000Z");
  });

  it("obtiene la fecha local de un instante", () => {
    // 03:00 UTC del día 8 sigue siendo el día 7 en Bogotá (UTC-5).
    expect(toDateKey(new Date("2030-01-08T03:00:00Z"), "America/Bogota")).toBe("2030-01-07");
    expect(toDateKey(new Date("2030-01-08T03:00:00Z"), "Europe/Madrid")).toBe("2030-01-08");
  });

  it("opera con fechas de calendario", () => {
    expect(addDaysToKey("2030-02-27", 2)).toBe("2030-03-01");
    expect(addDaysToKey("2030-01-01", -1)).toBe("2029-12-31");
    expect(diffInDays("2030-01-01", "2030-01-31")).toBe(30);
    expect(dayOfWeekOfKey("2030-01-07")).toBe(1);
    expect(startOfWeekKey("2030-01-13")).toBe("2030-01-07");
    expect(startOfWeekKey("2030-01-07")).toBe("2030-01-07");
    expect(monthRangeKeys("2030-12-15")).toEqual({ first: "2030-12-01", next: "2031-01-01" });
  });

  it("valida fechas y horas", () => {
    expect(isDateKey("2030-02-28")).toBe(true);
    expect(isDateKey("2030-02-30")).toBe(false);
    expect(isDateKey("30-02-2030")).toBe(false);
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(timeToMinutes("25:00")).toBeNaN();
    expect(minutesToTime(510)).toBe("08:30");
  });
});
