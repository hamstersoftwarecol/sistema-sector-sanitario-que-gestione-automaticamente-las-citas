"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { saveProfileAction } from "../actions";

export type ProfileFormValues = {
  name: string;
  phone: string;
  specialtyId: string;
  bio: string;
  licenseNumber: string;
  timezone: string;
  slotDurationMinutes: number;
  autoConfirm: boolean;
};

export function ProfileForm({
  values,
  specialties,
  timezones,
}: {
  values: ProfileFormValues;
  specialties: { id: string; name: string }[];
  timezones: readonly string[];
}) {
  const [state, action] = useActionState(saveProfileAction, undefined);
  const errors = state?.fieldErrors;
  // Tras un error de validación conservamos lo que escribió el médico (React reinicia el formulario).
  const sent = state?.values;
  const value = (key: keyof ProfileFormValues) => sent?.[key] ?? String(values[key]);

  return (
    <form key={JSON.stringify(sent ?? {})} action={action} className="space-y-6">
      {state?.success && <Alert>{state.success}</Alert>}
      {state?.error && <Alert tone="rose">{state.error}</Alert>}

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre visible para pacientes" htmlFor="name" error={errors?.name}>
          <Input id="name" name="name" defaultValue={value("name")} required />
        </Field>
        <Field label="Teléfono" htmlFor="phone" error={errors?.phone}>
          <Input id="phone" name="phone" type="tel" defaultValue={value("phone")} />
        </Field>
        <Field label="Especialidad" htmlFor="specialtyId" error={errors?.specialtyId}>
          <Select id="specialtyId" name="specialtyId" defaultValue={value("specialtyId")}>
            {specialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nº de registro profesional" htmlFor="licenseNumber" error={errors?.licenseNumber}>
          <Input id="licenseNumber" name="licenseNumber" defaultValue={value("licenseNumber")} />
        </Field>
        <Field
          label="Presentación"
          htmlFor="bio"
          error={errors?.bio}
          hint="Se muestra a los pacientes y ayuda al asistente a recomendarte."
          className="sm:col-span-2"
        >
          <Textarea id="bio" name="bio" defaultValue={value("bio")} maxLength={600} />
        </Field>
      </section>

      <section className="grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
        <Field label="Zona horaria" htmlFor="timezone" error={errors?.timezone}>
          <Select id="timezone" name="timezone" defaultValue={value("timezone")}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Duración de cada consulta" htmlFor="slotDurationMinutes" error={errors?.slotDurationMinutes}>
          <Select id="slotDurationMinutes" name="slotDurationMinutes" defaultValue={value("slotDurationMinutes")}>
            {[15, 20, 30, 45, 60].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutos
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <input type="checkbox" name="autoConfirm" defaultChecked={sent ? sent.autoConfirm === "on" : values.autoConfirm} className="mt-0.5 size-4 accent-brand-600" />
          <span>
            <span className="block text-sm font-semibold text-slate-800">Confirmar citas automáticamente</span>
            <span className="text-sm text-slate-500">
              Si lo desactivas, las nuevas reservas quedarán pendientes hasta que las confirmes.
            </span>
          </span>
        </label>
      </section>

      <SubmitButton pendingText="Guardando…">Guardar cambios</SubmitButton>
    </form>
  );
}
