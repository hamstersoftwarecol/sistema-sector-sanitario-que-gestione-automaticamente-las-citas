"use client";

import { useState, useTransition } from "react";
import { Copy, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import type { WeeklyRule } from "@/lib/scheduling/slots";
import { DAY_NAMES, minutesToTime, timeToMinutes } from "@/lib/scheduling/time";
import type { FormState } from "@/lib/validation";
import { saveAvailabilityAction } from "../actions";

type Range = { start: string; end: string };

// Lunes primero, domingo al final.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function toState(rules: WeeklyRule[]) {
  const state: Record<number, Range[]> = Object.fromEntries(WEEK_ORDER.map((d) => [d, []]));
  for (const rule of [...rules].sort((a, b) => a.startMinute - b.startMinute)) {
    state[rule.dayOfWeek]!.push({ start: minutesToTime(rule.startMinute), end: minutesToTime(rule.endMinute) });
  }
  return state;
}

export function AvailabilityEditor({ initialRules, slotMinutes }: { initialRules: WeeklyRule[]; slotMinutes: number }) {
  const [days, setDays] = useState(() => toState(initialRules));
  const [result, setResult] = useState<FormState>(undefined);
  const [pending, startTransition] = useTransition();

  function update(day: number, ranges: Range[]) {
    setDays((current) => ({ ...current, [day]: ranges }));
    setResult(undefined);
  }

  function copyMondayToWeekdays() {
    setDays((current) => ({ ...current, 2: [...current[1]!], 3: [...current[1]!], 4: [...current[1]!], 5: [...current[1]!] }));
    setResult(undefined);
  }

  function save() {
    const rules: WeeklyRule[] = [];
    for (const day of WEEK_ORDER) {
      for (const range of days[day]!) {
        const startMinute = timeToMinutes(range.start);
        const endMinute = timeToMinutes(range.end);
        if (Number.isNaN(startMinute) || Number.isNaN(endMinute)) {
          setResult({ error: `Revisa las horas del ${DAY_NAMES[day]!.toLowerCase()}.` });
          return;
        }
        rules.push({ dayOfWeek: day, startMinute, endMinute });
      }
    }
    startTransition(async () => setResult(await saveAvailabilityAction(rules)));
  }

  return (
    <div className="space-y-4">
      <div className="divide-y divide-slate-100">
        {WEEK_ORDER.map((day) => {
          const ranges = days[day]!;
          const enabled = ranges.length > 0;
          return (
            <div key={day} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
              <label className="flex w-40 shrink-0 items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(event) => update(day, event.target.checked ? [{ start: "09:00", end: "13:00" }] : [])}
                  className="size-4 rounded border-slate-300 accent-brand-600"
                />
                <span className="text-sm font-semibold text-slate-800">{DAY_NAMES[day]}</span>
              </label>
              <div className="flex-1 space-y-2">
                {!enabled && <p className="pt-2 text-sm text-slate-400">No atiendes este día</p>}
                {ranges.map((range, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="time"
                      step={300}
                      value={range.start}
                      aria-label={`${DAY_NAMES[day]} inicio franja ${index + 1}`}
                      onChange={(event) => update(day, ranges.map((r, i) => (i === index ? { ...r, start: event.target.value } : r)))}
                      className="w-32"
                    />
                    <span className="text-slate-400">–</span>
                    <Input
                      type="time"
                      step={300}
                      value={range.end}
                      aria-label={`${DAY_NAMES[day]} fin franja ${index + 1}`}
                      onChange={(event) => update(day, ranges.map((r, i) => (i === index ? { ...r, end: event.target.value } : r)))}
                      className="w-32"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => update(day, ranges.filter((_, i) => i !== index))}
                      aria-label="Quitar franja"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                {enabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => update(day, [...ranges, { start: ranges.at(-1)?.end ?? "14:00", end: "18:00" }])}
                  >
                    <Plus className="size-4" aria-hidden /> Añadir franja
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {result?.error && <Alert tone="rose">{result.error}</Alert>}
      {result?.success && <Alert>{result.success}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={copyMondayToWeekdays}>
          <Copy className="size-4" aria-hidden /> Copiar lunes a martes–viernes
        </Button>
        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">Consultas de {slotMinutes} min (cámbialo en Perfil)</p>
          <Button onClick={save} disabled={pending}>
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
            Guardar horario
          </Button>
        </div>
      </div>
    </div>
  );
}
