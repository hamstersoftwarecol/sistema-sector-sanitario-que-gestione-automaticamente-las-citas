"use client";

import { useActionState } from "react";
import { Ban, Check, CheckCheck, LoaderCircle, UserX } from "lucide-react";
import { saveDoctorNotesAction, updateAppointmentStatusAction } from "@/app/doctor/actions";
import { Button } from "./ui/button";
import { Textarea } from "./ui/form";

export function DoctorAppointmentActions({
  appointmentId,
  canConfirm,
  canClose,
  canCancel,
}: {
  appointmentId: string;
  canConfirm: boolean;
  canClose: boolean;
  canCancel: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAppointmentStatusAction, undefined);
  if (!canConfirm && !canClose && !canCancel) return null;

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-1 sm:items-end"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "cancel" && !window.confirm("¿Cancelar esta cita? Se liberará el horario.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <div className="flex flex-wrap gap-2">
        {pending && <LoaderCircle className="size-4 animate-spin self-center text-slate-400" aria-hidden />}
        {canConfirm && (
          <Button type="submit" name="action" value="confirm" size="sm" disabled={pending}>
            <Check className="size-3.5" aria-hidden /> Confirmar
          </Button>
        )}
        {canClose && (
          <>
            <Button type="submit" name="action" value="complete" size="sm" disabled={pending}>
              <CheckCheck className="size-3.5" aria-hidden /> Atendida
            </Button>
            <Button type="submit" name="action" value="no_show" size="sm" variant="secondary" disabled={pending}>
              <UserX className="size-3.5" aria-hidden /> No asistió
            </Button>
          </>
        )}
        {canCancel && (
          <Button type="submit" name="action" value="cancel" size="sm" variant="danger" disabled={pending}>
            <Ban className="size-3.5" aria-hidden /> Cancelar
          </Button>
        )}
      </div>
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
    </form>
  );
}

export function DoctorNotesForm({ appointmentId, notes }: { appointmentId: string; notes: string | null }) {
  const [state, formAction, pending] = useActionState(saveDoctorNotesAction, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <Textarea name="notes" defaultValue={state?.values?.notes ?? notes ?? ""} maxLength={4000} placeholder="Notas privadas sobre la consulta" className="min-h-20" />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />} Guardar notas
        </Button>
        {state?.success && <span className="text-xs text-brand-700">{state.success}</span>}
        {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
      </div>
    </form>
  );
}
