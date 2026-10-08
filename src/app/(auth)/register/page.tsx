import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { db } from "@/lib/db";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Crea tu cuenta</h1>
      <p className="mt-1 mb-8 text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
      <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
        <RegisterFormLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function RegisterFormLoader({ searchParams }: { searchParams: PageProps<"/register">["searchParams"] }) {
  await connection();
  const [{ role }, specialties] = await Promise.all([
    searchParams,
    db.specialty.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return <RegisterForm specialties={specialties} defaultRole={role === "doctor" ? "DOCTOR" : "PATIENT"} />;
}
