import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

const DEMO_ACCOUNTS = [
  { label: "Paciente", email: "paciente@medicita.dev" },
  { label: "Médico", email: "dra.gomez@medicita.dev" },
  { label: "Admin", email: "admin@medicita.dev" },
];

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Bienvenido de nuevo</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-semibold text-brand-700 hover:underline">
          Regístrate gratis
        </Link>
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LoginForm />
      </Suspense>
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Cuentas de demostración (tras ejecutar el seed)</p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                {account.label}: <code>{account.email}</code>
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Contraseña: <code>Demo1234!</code>
          </p>
        </div>
      )}
    </>
  );
}
