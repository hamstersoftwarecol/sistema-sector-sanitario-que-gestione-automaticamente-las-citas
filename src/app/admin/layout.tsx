import { DashboardShell } from "@/components/dashboard-shell";
import type { NavItem } from "@/components/nav-links";

const NAV: NavItem[] = [{ href: "/admin", label: "Plataforma", icon: "Users", exact: true }];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <DashboardShell nav={NAV} home="/admin">
      {children}
    </DashboardShell>
  );
}
