import { DashboardShell } from "@/components/dashboard-shell";
import type { NavItem } from "@/components/nav-links";

const NAV: NavItem[] = [
  { href: "/patient", label: "Inicio", icon: "LayoutDashboard", exact: true },
  { href: "/patient/assistant", label: "Asistente IA", icon: "Bot" },
  { href: "/patient/book", label: "Reservar cita", icon: "CalendarPlus" },
  { href: "/patient/appointments", label: "Mis citas", icon: "CalendarDays" },
];

export default function PatientLayout({ children }: LayoutProps<"/patient">) {
  return (
    <DashboardShell nav={NAV} home="/patient">
      {children}
    </DashboardShell>
  );
}
