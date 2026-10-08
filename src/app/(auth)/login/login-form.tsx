"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { loginAction } from "../actions";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  const searchParams = useSearchParams();

  return (
    <form action={action} className="space-y-5" noValidate>
      {searchParams.get("expired") && !state?.error && (
        <Alert tone="amber">Tu sesión ha caducado. Vuelve a iniciar sesión.</Alert>
      )}
      {state?.error && <Alert tone="rose">{state.error}</Alert>}
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      <Field label="Correo electrónico" htmlFor="email" error={state?.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
          defaultValue={state?.values?.email}
        />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={state?.fieldErrors?.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Entrando…">
        Iniciar sesión
      </SubmitButton>
    </form>
  );
}
