"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { addTimeOffAction } from "../actions";

export function TimeOffForm({ today }: { today: string }) {
  const [state, action] = useActionState(addTimeOffAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.success && <Alert>{state.success}</Alert>}
      {state?.error && <Alert tone="rose">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Desde" htmlFor="startDate" error={state?.fieldErrors?.startDate}>
          <Input id="startDate" name="startDate" type="date" min={today} defaultValue={state?.values?.startDate ?? today} required />
        </Field>
        <Field label="Hasta (incluido)" htmlFor="endDate" error={state?.fieldErrors?.endDate}>
          <Input id="endDate" name="endDate" type="date" min={today} defaultValue={state?.values?.endDate ?? today} required />
        </Field>
      </div>
      <Field label="Motivo (opcional)" htmlFor="reason" error={state?.fieldErrors?.reason}>
        <Input id="reason" name="reason" maxLength={120} defaultValue={state?.values?.reason} placeholder="Vacaciones, congreso…" />
      </Field>
      <SubmitButton variant="secondary" pendingText="Guardando…">
        Bloquear fechas
      </SubmitButton>
    </form>
  );
}
