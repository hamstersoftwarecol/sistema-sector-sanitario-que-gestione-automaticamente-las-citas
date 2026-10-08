import { DashboardShell } from "@/components/dashboard-shell";
import type { NavItem } from "@/components/nav-links";

const NAV: NavItem[] = [
  { href: "/doctor", label: "Resumen", icon: "LayoutDashboard", exact: true },
  { href: "/doctor/calendar", label: "Agenda semanal", icon: "CalendarDays" },
  { href: "/doctor/appointments", label: "Citas", icon: "ClipboardList" },
  { href: "/doctor/availability", label: "Disponibilidad", icon: "Clock" },
  { href: "/doctor/billing", label: "Suscripción", icon: "CreditCard" },
  { href: "/doctor/settings", label: "Perfil", icon: "Settings" },
];

export default function DoctorLayout({ children }: LayoutProps<"/doctor">) {
  return (
    <DashboardShell nav={NAV} home="/doctor">
      {children}
    </DashboardShell>
  );
}
