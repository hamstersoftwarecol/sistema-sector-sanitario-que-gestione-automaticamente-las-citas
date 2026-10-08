"use client";

import { useActionState } from "react";
import { LoaderCircle, X } from "lucide-react";
import type { FormState } from "@/lib/validation";
import { Button } from "./ui/button";

export function CancelAppointmentButton({
  appointmentId,
  action,
  label = "Cancelar",
}: {
  appointmentId: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("¿Seguro que quieres cancelar esta cita?")) event.preventDefault();
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <Button type="submit" variant="danger" size="sm" disabled={pending}>
        {pending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> : <X className="size-3.5" aria-hidden />}
        {label}
      </Button>
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
    </form>
  );
}
