"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Algo salió mal</h1>
      <p className="mt-2 max-w-md text-slate-500">
        Ocurrió un error inesperado. Puedes intentarlo de nuevo; si el problema persiste, contacta con soporte.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Ref: {error.digest}</p>}
      <Button className="mt-6" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  );
}
