import { Bot, CalendarCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

const HIGHLIGHTS = [
  { icon: Bot, text: "Un asistente de IA que entiende al paciente y reserva por él." },
  { icon: CalendarCheck, text: "Agenda sincronizada con la disponibilidad real de cada médico." },
  { icon: ShieldCheck, text: "Datos protegidos, sesiones cifradas y acceso por roles." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-700 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
        <div className="relative flex h-full flex-col justify-center px-16 text-white">
          <p className="text-sm font-semibold tracking-wide text-brand-200 uppercase">Agenda médica inteligente</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">Tu consulta se llena sola, sin llamadas ni esperas.</h2>
          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-brand-50">
                <span className="rounded-lg bg-white/10 p-2">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
