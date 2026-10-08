import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { initials } from "@/lib/utils";
import { Skeleton } from "./ui/feedback";

export async function UserMenu({ compact = false }: { compact?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2 lg:p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
        {initials(user.name)}
      </span>
      {!compact && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
        </div>
      )}
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          title="Cerrar sesión"
        >
          <LogOut className="size-4" aria-hidden />
          <span className="sr-only">Cerrar sesión</span>
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton({ compact = false }: { compact?: boolean }) {
  return compact ? <Skeleton className="size-11 rounded-xl" /> : <Skeleton className="h-16 w-full rounded-xl" />;
}
