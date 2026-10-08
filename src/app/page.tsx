import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CalendarDays,
  Check,
  Clock,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { PLANS } from "@/lib/plans";
import { cn, formatMoney } from "@/lib/utils";

const FEATURES = [
  {
    icon: Bot,
    title: "Asistente de IA que agenda solo",
    text: "El paciente describe lo que le pasa; el agente sugiere la especialidad, busca huecos reales y reserva la cita.",
  },
  {
    icon: CalendarCheck,
    title: "Reserva automática sin dobles citas",
    text: "Cada reserva se valida contra el horario, los bloqueos y las citas existentes en una transacción segura.",
  },
  {
    icon: Clock,
    title: "Disponibilidad flexible",
    text: "Horarios semanales por franjas, duración de consulta configurable y bloqueos por vacaciones o congresos.",
  },
  {
    icon: LayoutDashboard,
    title: "Paneles para pacientes y médicos",
    text: "Pacientes gestionan sus citas; médicos ven su agenda del día, la semana y las métricas del mes.",
  },
  {
    icon: Sparkles,
    title: "Resumen pre-consulta con IA",
    text: "El asistente deja al médico un resumen objetivo de síntomas y antecedentes antes de la visita.",
  },
  {
    icon: ShieldCheck,
    title: "Seguro y listo para producción",
    text: "Sesiones cifradas, control de acceso por roles, límites de uso de IA y pagos gestionados por Stripe.",
  },
];

const STEPS = [
  { icon: Stethoscope, title: "El médico define su agenda", text: "Configura sus horarios y la duración de sus consultas en dos minutos." },
  { icon: Bot, title: "El paciente habla con la IA", text: "Cuenta qué necesita y el asistente le propone las mejores opciones." },
  { icon: CalendarDays, title: "La cita queda reservada", text: "Aparece al instante en el panel del médico, con el resumen de la IA." },
];

const CHAT_PREVIEW = [
  { from: "patient", text: "Hola, tengo dolor en el pecho al subir escaleras desde hace una semana." },
  {
    from: "ai",
    text: "Gracias por contármelo. Si el dolor es intenso o aparece en reposo, llama ya al 123. Para valorarlo, te recomiendo Cardiología. Tengo estos horarios:",
  },
  { from: "slots", text: "" },
  { from: "patient", text: "El martes a las 9:00, por favor." },
  { from: "ai", text: "¡Listo! Cita reservada con la Dra. Laura Gómez el martes 14 a las 09:00. ✅" },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#funciones" className="hover:text-slate-900">Funciones</a>
            <a href="#como-funciona" className="hover:text-slate-900">Cómo funciona</a>
            <a href="#precios" className="hover:text-slate-900">Precios</a>
          </nav>
          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Iniciar sesión
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Empezar gratis
            </ButtonLink>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,var(--color-brand-100),transparent_65%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
              <Sparkles className="size-3.5" aria-hidden /> Agenda médica con agentes de IA
            </p>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Tu clínica agenda citas <span className="text-brand-600">automáticamente</span>, las 24 horas.
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              MediCita IA es el SaaS que conecta a pacientes y médicos: un asistente inteligente entiende al paciente,
              encuentra el especialista adecuado y reserva en la agenda real del profesional. Sin llamadas, sin esperas.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register?role=doctor" size="lg">
                Soy médico o clínica <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/register" size="lg" variant="secondary">
                <UserRound className="size-4" aria-hidden /> Soy paciente
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-slate-500">Plan gratuito para siempre · Sin tarjeta de crédito</p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand-200/60 to-sky-200/40 blur-2xl" />
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Bot className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">Sofía · Asistente de citas</p>
                  <p className="text-xs text-emerald-600">En línea</p>
                </div>
              </div>
              <div className="space-y-3 px-4 py-5 text-sm">
                {CHAT_PREVIEW.map((message, i) =>
                  message.from === "slots" ? (
                    <div key={i} className="flex flex-wrap gap-2 pl-1">
                      {["Mar 14 · 09:00", "Mar 14 · 11:30", "Mié 15 · 16:00"].map((slot) => (
                        <span key={slot} className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                          {slot}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div key={i} className={cn("flex", message.from === "patient" ? "justify-end" : "justify-start")}>
                      <p
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2",
                          message.from === "patient" ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-slate-100 text-slate-800",
                        )}
                      >
                        {message.text}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="funciones" className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-700">Funciones</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Todo lo que una consulta moderna necesita</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-700">Cómo funciona</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">De la duda del paciente a la cita confirmada</h2>
          </div>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="relative">
                <span className="text-6xl font-black text-brand-100">{index + 1}</span>
                <div className="-mt-6 pl-2">
                  <Icon className="size-6 text-brand-600" aria-hidden />
                  <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="precios" className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-brand-700">Precios</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Planes para médicos y clínicas</h2>
            <p className="mt-3 text-slate-600">Para los pacientes, MediCita IA es siempre gratis.</p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {Object.values(PLANS).map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-white p-8 shadow-sm",
                  plan.highlighted ? "border-brand-500 ring-2 ring-brand-500" : "border-slate-200",
                )}
              >
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-6">
                  <span className="text-4xl font-extrabold tracking-tight">{formatMoney(plan.priceCents)}</span>
                  <span className="text-sm text-slate-500"> USD/mes</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> {feature}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href="/register?role=doctor"
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="mt-8 w-full"
                >
                  {plan.priceCents === 0 ? "Empezar gratis" : `Probar ${plan.name}`}
                </ButtonLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight">Deja que la IA llene tu agenda</h2>
          <p className="mt-3 text-slate-600">Crea tu cuenta, define tu horario y empieza a recibir reservas hoy mismo.</p>
          <div className="mt-8 flex justify-center gap-3">
            <ButtonLink href="/register?role=doctor" size="lg">
              Crear cuenta de médico
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="secondary">
              Ya tengo cuenta
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>MediCita IA no sustituye la atención médica de urgencia. En una emergencia, llama a tu línea local.</p>
          <Link href="/login" className="hover:text-slate-900">
            Acceso
          </Link>
        </div>
      </footer>
    </div>
  );
}
