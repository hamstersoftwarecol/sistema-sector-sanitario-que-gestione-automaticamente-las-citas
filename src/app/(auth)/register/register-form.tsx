"use client";

import { useActionState, useState } from "react";
import { Stethoscope, UserRound } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { registerAction } from "../actions";

type Role = "PATIENT" | "DOCTOR";

const ROLES: { value: Role; title: string; description: string; icon: typeof UserRound }[] = [
  { value: "PATIENT", title: "Soy paciente", description: "Reserva citas con ayuda de la IA", icon: UserRound },
  { value: "DOCTOR", title: "Soy médico", description: "Gestiona tu agenda y pacientes", icon: Stethoscope },
];

export function RegisterForm({ specialties, defaultRole }: { specialties: { id: string; name: string }[]; defaultRole: Role }) {
  const [state, action] = useActionState(registerAction, undefined);
  const values = state?.values;
  const [role, setRole] = useState<Role>(defaultRole);

  return (
    // La key remonta el formulario con lo enviado: React reinicia los campos tras cada acción
    // y un <select> solo toma su defaultValue al montarse.
    <form key={JSON.stringify(values ?? {})} action={action} className="space-y-5" noValidate>
      <input type="hidden" name="role" value={role} />
      {state?.error && <Alert tone="rose">{state.error}</Alert>}

      <fieldset>
        <legend className="sr-only">Tipo de cuenta</legend>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map(({ value, title, description, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-xl border p-4 transition-colors",
                role === value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <input
                type="radio"
                name="roleChoice"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              <Icon className={cn("size-5", role === value ? "text-brand-700" : "text-slate-400")} aria-hidden />
              <p className="mt-2 text-sm font-semibold">{title}</p>
              <p className="text-xs text-slate-500">{description}</p>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Nombre completo" htmlFor="name" error={state?.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          defaultValue={values?.name}
          placeholder={role === "DOCTOR" ? "Dra. Ana Gómez" : "Juan Pérez"}
        />
      </Field>
      <Field label="Correo electrónico" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={values?.email} placeholder="tu@correo.com" />
      </Field>
      <Field label="Teléfono (opcional)" htmlFor="phone" error={state?.fieldErrors?.phone}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={values?.phone} placeholder="+57 300 000 0000" />
      </Field>
      {role === "DOCTOR" && (
        <Field label="Especialidad" htmlFor="specialtyId" error={state?.fieldErrors?.specialtyId}>
          <Select id="specialtyId" name="specialtyId" defaultValue={values?.specialtyId ?? ""} required>
            <option value="" disabled>
              Selecciona tu especialidad
            </option>
            {specialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field
        label="Contraseña"
        htmlFor="password"
        error={state?.fieldErrors?.password}
        hint="Mínimo 8 caracteres, con letras y números."
      >
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <SubmitButton className="w-full" pendingText="Creando cuenta…">
        Crear cuenta
      </SubmitButton>
      <p className="text-center text-xs text-slate-500">
        Al registrarte aceptas el tratamiento de tus datos para gestionar tus citas médicas.
      </p>
    </form>
  );
}
