import { Suspense, type ReactNode } from "react";
import { Logo } from "./logo";
import { NavLinks, type NavItem } from "./nav-links";
import { UserMenu, UserMenuSkeleton } from "./user-menu";

export function DashboardShell({ nav, home, children }: { nav: NavItem[]; home: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <Logo href={home} className="px-2" />
        <div className="mt-8 flex-1">
          <NavLinks items={nav} />
        </div>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 pt-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between pb-2">
            <Logo href={home} />
            <Suspense fallback={<UserMenuSkeleton compact />}>
              <UserMenu compact />
            </Suspense>
          </div>
          <NavLinks items={nav} orientation="horizontal" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
