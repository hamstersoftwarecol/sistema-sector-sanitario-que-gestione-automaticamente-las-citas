import type { Metadata } from "next";
import { Suspense } from "react";
import { Bot, CalendarCheck, CreditCard, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, PageHeader, Skeleton, StatCard } from "@/components/ui/feedback";
import { requireUser } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/appointments";
import { db } from "@/lib/db";
import { PLANS, resolvePlan } from "@/lib/plans";
import { ROLE_LABEL } from "@/lib/roles";
import { DEFAULT_TIMEZONE, formatDate } from "@/lib/scheduling/time";

export const metadata: Metadata = { title: "Administración" };

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Plataforma" description="Métricas globales de uso, usuarios y suscripciones." />
      <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-2xl" />}>
        <AdminContent />
      </Suspense>
    </>
  );
}

// Fuera del componente: las consultas dependen de la hora actual.
async function loadPlatformMetrics() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [usersByRole, appointmentsByStatus, aiBooked, recentUsers, doctors] = await Promise.all([
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.appointment.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: since } } }),
    db.appointment.count({ where: { createdAt: { gte: since }, source: "AI_ASSISTANT" } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 10, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    db.doctorProfile.findMany({ select: { subscription: { select: { plan: true, status: true } } } }),
  ]);
  return { usersByRole, appointmentsByStatus, aiBooked, recentUsers, doctors };
}

async function AdminContent() {
  await requireUser("ADMIN");
  const { usersByRole, appointmentsByStatus, aiBooked, recentUsers, doctors } = await loadPlatformMetrics();

  const count = (role: string) => usersByRole.find((row) => row.role === role)?._count._all ?? 0;
  const totalAppointments = appointmentsByStatus.reduce((sum, row) => sum + row._count._all, 0);
  const planCounts = doctors.reduce<Record<string, number>>((acc, doctor) => {
    const plan = resolvePlan(doctor.subscription).id;
    acc[plan] = (acc[plan] ?? 0) + 1;
    return acc;
  }, {});
  const mrr = Object.entries(planCounts).reduce((sum, [plan, n]) => sum + PLANS[plan as keyof typeof PLANS].priceCents * n, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pacientes" value={count("PATIENT")} icon={<Users className="size-5" />} />
        <StatCard label="Médicos" value={count("DOCTOR")} icon={<Users className="size-5" />} />
        <StatCard label="Citas (30 días)" value={totalAppointments} icon={<CalendarCheck className="size-5" />} />
        <StatCard
          label="Reservadas por IA"
          value={totalAppointments ? `${Math.round((aiBooked / totalAppointments) * 100)}%` : "0%"}
          hint={`${aiBooked} en los últimos 30 días`}
          icon={<Bot className="size-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Suscripciones" description={`Ingresos recurrentes estimados: $${(mrr / 100).toLocaleString("es-CO")} USD/mes`} action={<CreditCard className="size-5 text-brand-600" />} />
          <CardBody className="space-y-3">
            {Object.values(PLANS).map((plan) => (
              <div key={plan.id} className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{plan.name}</span>
                <Badge tone={plan.id === "FREE" ? "slate" : "teal"}>{planCounts[plan.id] ?? 0} médicos</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Citas por estado (30 días)" />
          <CardBody className="space-y-3">
            {appointmentsByStatus.length === 0 && <p className="text-sm text-slate-500">Sin citas recientes.</p>}
            {appointmentsByStatus.map((row) => (
              <div key={row.status} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{STATUS_LABEL[row.status]}</span>
                <span className="font-semibold tabular-nums">{row._count._all}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Últimos registros" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Correo</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-5 py-3 text-slate-600">{user.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone={user.role === "DOCTOR" ? "sky" : user.role === "ADMIN" ? "violet" : "slate"}>{ROLE_LABEL[user.role]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDate(user.createdAt, DEFAULT_TIMEZONE, "short")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
