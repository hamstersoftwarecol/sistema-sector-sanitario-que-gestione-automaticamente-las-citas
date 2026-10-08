// Pruebas contra PostgreSQL real. Se ejecutan solo si TEST_DATABASE_URL apunta a una base de datos
// de pruebas con las migraciones aplicadas (¡se vacía en cada test!).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PlanTier } from "@/generated/prisma/enums";
import { zonedDateTime } from "@/lib/scheduling/time";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const TZ = "America/Bogota";
const NOW = new Date("2030-01-01T12:00:00Z");
const MONDAY = "2030-01-07"; // lunes
const at = (dateKey: string, minutes: number) => zonedDateTime(dateKey, minutes, TZ);
const NINE = 9 * 60;

describe.skipIf(!TEST_DATABASE_URL)("reservas (integración)", () => {
  let db: (typeof import("@/lib/db"))["db"];
  let booking: typeof import("@/lib/scheduling/booking");
  let tools: typeof import("@/lib/ai/tools");
  let specialtyId: string;
  let counter = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    ({ db } = await import("@/lib/db"));
    booking = await import("@/lib/scheduling/booking");
    tools = await import("@/lib/ai/tools");
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE "Appointment", "TimeOff", "AvailabilityRule", "Subscription", "DoctorProfile", "Specialty", "AiUsage", "AiConversation", "User" CASCADE',
    );
    specialtyId = (await db.specialty.create({ data: { slug: "cardiologia", name: "Cardiología", description: "Corazón" } })).id;
  });

  async function createPatient() {
    counter++;
    return db.user.create({ data: { email: `paciente${counter}@test.dev`, name: `Paciente ${counter}`, passwordHash: "x" } });
  }

  async function createDoctor(options: { plan?: PlanTier; autoConfirm?: boolean } = {}) {
    counter++;
    const user = await db.user.create({
      data: { email: `medico${counter}@test.dev`, name: `Dr. Prueba ${counter}`, role: "DOCTOR", passwordHash: "x" },
    });
    const profile = await db.doctorProfile.create({
      data: {
        userId: user.id,
        specialtyId,
        timezone: TZ,
        slotDurationMinutes: 30,
        autoConfirm: options.autoConfirm ?? true,
        availability: { create: [{ dayOfWeek: 1, startMinute: 9 * 60, endMinute: 12 * 60 }] },
      },
    });
    const plan = options.plan ?? "PRO";
    if (plan !== "FREE") await db.subscription.create({ data: { doctorId: profile.id, plan, status: "active" } });
    return profile;
  }

  const book = (patientId: string, doctorId: string, startsAt: Date, source: "MANUAL" | "AI_ASSISTANT" = "MANUAL") =>
    booking.bookAppointment({ patientId, doctorId, startsAt, reason: "Control", source, now: NOW });

  it("reserva un hueco libre y lo confirma automáticamente", async () => {
    const [doctor, patient] = await Promise.all([createDoctor(), createPatient()]);
    const appointment = await book(patient.id, doctor.id, at(MONDAY, NINE));

    expect(appointment.status).toBe("CONFIRMED");
    expect(appointment.endsAt.getTime() - appointment.startsAt.getTime()).toBe(30 * 60_000);
    expect(appointment.doctor.specialty.name).toBe("Cardiología");
  });

  it("deja la cita pendiente cuando el médico revisa las reservas", async () => {
    const [doctor, patient] = await Promise.all([createDoctor({ autoConfirm: false }), createPatient()]);
    expect((await book(patient.id, doctor.id, at(MONDAY, NINE))).status).toBe("PENDING");
  });

  it("rechaza un hueco ya ocupado y horarios fuera de la disponibilidad", async () => {
    const [doctor, p1, p2] = await Promise.all([createDoctor(), createPatient(), createPatient()]);
    await book(p1.id, doctor.id, at(MONDAY, NINE));

    await expect(book(p2.id, doctor.id, at(MONDAY, NINE))).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(book(p2.id, doctor.id, at(MONDAY, 13 * 60))).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    await expect(book(p2.id, doctor.id, at(MONDAY, NINE + 10))).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("con reservas simultáneas al mismo hueco solo una gana", async () => {
    const doctor = await createDoctor();
    const patients = await Promise.all(Array.from({ length: 5 }, () => createPatient()));

    const results = await Promise.allSettled(patients.map((p) => book(p.id, doctor.id, at(MONDAY, NINE))));

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const result of results.filter((r) => r.status === "rejected")) {
      expect((result as PromiseRejectedResult).reason).toMatchObject({ code: "SLOT_UNAVAILABLE" });
    }
    expect(await db.appointment.count({ where: { doctorId: doctor.id } })).toBe(1);
  });

  it("respeta los bloqueos de agenda", async () => {
    const [doctor, patient] = await Promise.all([createDoctor(), createPatient()]);
    await db.timeOff.create({ data: { doctorId: doctor.id, startsAt: at(MONDAY, 0), endsAt: at("2030-01-08", 0) } });
    await expect(book(patient.id, doctor.id, at(MONDAY, NINE))).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("impide reservar por IA con médicos del plan gratuito, pero permite la reserva manual", async () => {
    const [doctor, patient] = await Promise.all([createDoctor({ plan: "FREE" }), createPatient()]);
    await expect(book(patient.id, doctor.id, at(MONDAY, NINE), "AI_ASSISTANT")).rejects.toMatchObject({ code: "AI_BOOKING_DISABLED" });
    await expect(book(patient.id, doctor.id, at(MONDAY, NINE), "MANUAL")).resolves.toMatchObject({ source: "MANUAL" });
  });

  it("aplica el límite mensual de citas del plan", async () => {
    const [doctor, patient, filler] = await Promise.all([createDoctor({ plan: "FREE" }), createPatient(), createPatient()]);
    // 30 citas (límite del plan Básico) repartidas por enero, fuera del lunes 7.
    await db.appointment.createMany({
      data: Array.from({ length: 30 }, (_, i) => {
        const startsAt = at(`2030-01-${String(10 + Math.floor(i / 10)).padStart(2, "0")}`, NINE + (i % 10) * 30);
        return { patientId: filler.id, doctorId: doctor.id, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), reason: "x" };
      }),
    });
    await expect(book(patient.id, doctor.id, at(MONDAY, NINE))).rejects.toMatchObject({ code: "PLAN_LIMIT_REACHED" });

    // Las citas canceladas no cuentan para el límite.
    await db.appointment.updateMany({ where: { doctorId: doctor.id }, data: { status: "CANCELLED" } });
    await expect(book(patient.id, doctor.id, at(MONDAY, NINE))).resolves.toBeTruthy();
  });

  it("impide que un paciente tenga dos citas a la misma hora", async () => {
    const [d1, d2, patient] = await Promise.all([createDoctor(), createDoctor(), createPatient()]);
    await book(patient.id, d1.id, at(MONDAY, NINE));
    await expect(book(patient.id, d2.id, at(MONDAY, NINE))).rejects.toMatchObject({ code: "PATIENT_CONFLICT" });
  });

  it("cancelar libera el hueco y solo el dueño puede cancelar", async () => {
    const [doctor, patient, other] = await Promise.all([createDoctor(), createPatient(), createPatient()]);
    const appointment = await book(patient.id, doctor.id, at(MONDAY, NINE));
    const asPatient = (user: { id: string }) => ({ id: user.id, role: "PATIENT" as const, doctorProfileId: null });

    await expect(booking.cancelAppointment({ appointmentId: appointment.id, actor: asPatient(other), now: NOW })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await booking.cancelAppointment({ appointmentId: appointment.id, actor: asPatient(patient), now: NOW });
    await expect(booking.cancelAppointment({ appointmentId: appointment.id, actor: asPatient(patient), now: NOW })).rejects.toMatchObject({
      code: "INVALID_STATE",
    });

    await expect(book(other.id, doctor.id, at(MONDAY, NINE))).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("reprogramar crea la nueva cita y cancela la anterior en una transacción", async () => {
    const [doctor, patient] = await Promise.all([createDoctor(), createPatient()]);
    const original = await book(patient.id, doctor.id, at(MONDAY, NINE));

    const moved = await booking.rescheduleAppointment({
      appointmentId: original.id,
      patientId: patient.id,
      newStartsAt: at(MONDAY, NINE + 60),
      source: "MANUAL",
      now: NOW,
    });

    expect(moved.startsAt.getTime()).toBe(at(MONDAY, NINE + 60).getTime());
    expect(moved.reason).toBe(original.reason);
    expect((await db.appointment.findUniqueOrThrow({ where: { id: original.id } })).status).toBe("CANCELLED");

    // Si el nuevo horario no está libre, no cambia nada.
    await expect(
      booking.rescheduleAppointment({ appointmentId: moved.id, patientId: patient.id, newStartsAt: at(MONDAY, 13 * 60), source: "MANUAL", now: NOW }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
    expect((await db.appointment.findUniqueOrThrow({ where: { id: moved.id } })).status).toBe("CONFIRMED");
  });

  it("el médico confirma, cierra y no puede cerrar citas futuras", async () => {
    const [doctor, patient] = await Promise.all([createDoctor({ autoConfirm: false }), createPatient()]);
    const appointment = await book(patient.id, doctor.id, at(MONDAY, NINE));
    const actor = { id: doctor.userId, role: "DOCTOR" as const, doctorProfileId: doctor.id };

    await booking.updateAppointmentByDoctor({ appointmentId: appointment.id, actor, action: "confirm", now: NOW });
    await expect(
      booking.updateAppointmentByDoctor({ appointmentId: appointment.id, actor, action: "complete", now: NOW }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await booking.updateAppointmentByDoctor({ appointmentId: appointment.id, actor, action: "complete", now: at(MONDAY, NINE + 40) });

    expect((await db.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).status).toBe("COMPLETED");
  });

  describe("herramientas del agente de IA", () => {
    it("busca huecos solo en médicos con reservas por IA y reserva con resumen pre-consulta", async () => {
      const [aiDoctor, , patient] = await Promise.all([createDoctor({ plan: "PRO" }), createDoctor({ plan: "FREE" }), createPatient()]);
      const toolset = tools.createSchedulingTools({ patientId: patient.id, now: NOW, timeZone: TZ });

      const search = (await toolset.find_available_slots!.execute({ specialty: "Cardiologia", limit: 3 })) as {
        slots: { doctorId: string; startsAt: string }[];
      };
      expect(search.slots).toHaveLength(3);
      expect(new Set(search.slots.map((s) => s.doctorId))).toEqual(new Set([aiDoctor.id]));
      expect(search.slots[0]!.startsAt).toBe(at(MONDAY, NINE).toISOString());

      const booked = (await toolset.book_appointment!.execute({
        doctorId: aiDoctor.id,
        startsAt: search.slots[0]!.startsAt,
        reason: "Palpitaciones",
        summary: "Palpitaciones de 3 semanas al hacer ejercicio.",
      })) as { appointment: { appointmentId: string; status: string } };
      expect(booked.appointment.status).toBe("CONFIRMED");

      const stored = await db.appointment.findUniqueOrThrow({ where: { id: booked.appointment.appointmentId } });
      expect(stored).toMatchObject({ source: "AI_ASSISTANT", aiSummary: "Palpitaciones de 3 semanas al hacer ejercicio." });

      const mine = (await toolset.list_my_appointments!.execute({})) as { upcoming: unknown[] };
      expect(mine.upcoming).toHaveLength(1);
    });

    it("devuelve errores de negocio y de validación como ToolError", async () => {
      const [doctor, patient] = await Promise.all([createDoctor(), createPatient()]);
      const toolset = tools.createSchedulingTools({ patientId: patient.id, now: NOW, timeZone: TZ });
      const { ToolError } = await import("@/lib/ai/agent");

      await expect(
        toolset.book_appointment!.execute({ doctorId: doctor.id, startsAt: at(MONDAY, 13 * 60).toISOString(), reason: "Control", summary: "" }),
      ).rejects.toBeInstanceOf(ToolError);
      await expect(toolset.find_available_slots!.execute({})).rejects.toBeInstanceOf(ToolError);
      await expect(toolset.find_available_slots!.execute({ specialty: "astrología" })).rejects.toThrow(/No existe la especialidad/);
    });
  });
});
