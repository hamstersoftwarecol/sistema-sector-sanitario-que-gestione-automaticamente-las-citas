// Datos de demostración: especialidades, médicos con horarios, un paciente, un admin y algunas citas.
// Ejecutar con `npm run db:seed`. Es idempotente: se puede lanzar varias veces.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { PlanTier } from "../src/generated/prisma/enums";
import { addDaysToKey, dayOfWeekOfKey, toDateKey, zonedDateTime } from "../src/lib/scheduling/time";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const PASSWORD = "Demo1234!";
const TZ = "America/Bogota";

const SPECIALTIES = [
  { slug: "medicina-general", name: "Medicina general", description: "Primera consulta, chequeos, malestar general, fiebre, infecciones comunes." },
  { slug: "cardiologia", name: "Cardiología", description: "Corazón y sistema circulatorio: dolor torácico, palpitaciones, hipertensión." },
  { slug: "dermatologia", name: "Dermatología", description: "Piel, cabello y uñas: acné, manchas, lunares, alergias cutáneas." },
  { slug: "pediatria", name: "Pediatría", description: "Salud de bebés, niños y adolescentes." },
  { slug: "psicologia", name: "Psicología", description: "Ansiedad, estrés, estado de ánimo, terapia individual o de pareja." },
  { slug: "ginecologia", name: "Ginecología", description: "Salud femenina, controles, embarazo y planificación familiar." },
  { slug: "traumatologia", name: "Traumatología", description: "Huesos, articulaciones y músculos: lesiones, dolor de espalda o rodilla." },
  { slug: "oftalmologia", name: "Oftalmología", description: "Salud visual: revisión de la vista, ojo rojo, molestias oculares." },
];

const WEEKDAYS_SPLIT = [1, 2, 3, 4, 5].flatMap((day) => [
  { dayOfWeek: day, startMinute: 8 * 60, endMinute: 12 * 60 },
  { dayOfWeek: day, startMinute: 14 * 60, endMinute: 18 * 60 },
]);
const MORNINGS_AND_SATURDAY = [
  ...[1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startMinute: 7 * 60, endMinute: 13 * 60 })),
  { dayOfWeek: 6, startMinute: 8 * 60, endMinute: 12 * 60 },
];
const AFTERNOONS = [1, 2, 3, 4, 5].map((day) => ({ dayOfWeek: day, startMinute: 13 * 60, endMinute: 19 * 60 }));

const DOCTORS: {
  email: string;
  name: string;
  specialty: string;
  bio: string;
  slot: number;
  plan: PlanTier;
  availability: { dayOfWeek: number; startMinute: number; endMinute: number }[];
}[] = [
  { email: "dra.gomez@medicita.dev", name: "Dra. Laura Gómez", specialty: "cardiologia", bio: "Cardióloga con 15 años de experiencia en prevención cardiovascular e hipertensión.", slot: 30, plan: "PRO", availability: WEEKDAYS_SPLIT },
  { email: "dr.rojas@medicita.dev", name: "Dr. Andrés Rojas", specialty: "medicina-general", bio: "Médico de familia. Atención integral para adultos y chequeos preventivos.", slot: 20, plan: "CLINIC", availability: MORNINGS_AND_SATURDAY },
  { email: "dra.martinez@medicita.dev", name: "Dra. Valentina Martínez", specialty: "medicina-general", bio: "Medicina general con enfoque en enfermedades crónicas y bienestar.", slot: 20, plan: "PRO", availability: AFTERNOONS },
  { email: "dr.herrera@medicita.dev", name: "Dr. Camilo Herrera", specialty: "dermatologia", bio: "Dermatología clínica y estética. Acné, lunares y dermatitis.", slot: 30, plan: "PRO", availability: WEEKDAYS_SPLIT },
  { email: "dra.lopez@medicita.dev", name: "Dra. Mariana López", specialty: "pediatria", bio: "Pediatra. Control de niño sano, vacunación y enfermedades respiratorias.", slot: 30, plan: "PRO", availability: MORNINGS_AND_SATURDAY },
  { email: "dr.castro@medicita.dev", name: "Dr. Felipe Castro", specialty: "psicologia", bio: "Psicólogo clínico. Terapia cognitivo-conductual para ansiedad y estrés.", slot: 60, plan: "PRO", availability: AFTERNOONS },
  { email: "dra.ramirez@medicita.dev", name: "Dra. Paula Ramírez", specialty: "ginecologia", bio: "Ginecología y obstetricia. Controles anuales y planificación familiar.", slot: 30, plan: "PRO", availability: WEEKDAYS_SPLIT },
  { email: "dr.vargas@medicita.dev", name: "Dr. Santiago Vargas", specialty: "traumatologia", bio: "Traumatología deportiva: rodilla, hombro y columna.", slot: 30, plan: "FREE", availability: WEEKDAYS_SPLIT },
  { email: "dra.moreno@medicita.dev", name: "Dra. Isabel Moreno", specialty: "oftalmologia", bio: "Oftalmología general y revisión de agudeza visual.", slot: 20, plan: "PRO", availability: MORNINGS_AND_SATURDAY },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  for (const specialty of SPECIALTIES) {
    await db.specialty.upsert({ where: { slug: specialty.slug }, create: specialty, update: specialty });
  }
  const specialtyIds = Object.fromEntries((await db.specialty.findMany()).map((s) => [s.slug, s.id]));

  await db.user.upsert({
    where: { email: "admin@medicita.dev" },
    create: { email: "admin@medicita.dev", name: "Admin MediCita", role: "ADMIN", passwordHash },
    update: {},
  });

  const patient = await db.user.upsert({
    where: { email: "paciente@medicita.dev" },
    create: { email: "paciente@medicita.dev", name: "Carlos Pérez", role: "PATIENT", phone: "+57 300 123 4567", passwordHash },
    update: {},
  });

  const doctorIds: Record<string, string> = {};
  for (const doctor of DOCTORS) {
    const user = await db.user.upsert({
      where: { email: doctor.email },
      create: { email: doctor.email, name: doctor.name, role: "DOCTOR", passwordHash },
      update: { name: doctor.name },
    });
    const profile = await db.doctorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        specialtyId: specialtyIds[doctor.specialty]!,
        bio: doctor.bio,
        slotDurationMinutes: doctor.slot,
        timezone: TZ,
        licenseNumber: `RM-${Math.floor(100000 + Math.random() * 899999)}`,
      },
      update: { bio: doctor.bio, slotDurationMinutes: doctor.slot, specialtyId: specialtyIds[doctor.specialty]! },
    });
    doctorIds[doctor.email] = profile.id;

    await db.availabilityRule.deleteMany({ where: { doctorId: profile.id } });
    await db.availabilityRule.createMany({ data: doctor.availability.map((rule) => ({ ...rule, doctorId: profile.id })) });

    // Suscripción de demostración (sin Stripe): permite probar las reservas por IA.
    if (doctor.plan !== "FREE") {
      await db.subscription.upsert({
        where: { doctorId: profile.id },
        create: { doctorId: profile.id, plan: doctor.plan, status: "active" },
        update: { plan: doctor.plan, status: "active" },
      });
    }
  }

  // Un par de citas para que los paneles no estén vacíos.
  const hasAppointments = await db.appointment.count({ where: { patientId: patient.id } });
  if (hasAppointments === 0) {
    let day = addDaysToKey(toDateKey(new Date(), TZ), 2);
    while ([0, 6].includes(dayOfWeekOfKey(day))) day = addDaysToKey(day, 1);

    const cardiologist = doctorIds["dra.gomez@medicita.dev"]!;
    await db.appointment.createMany({
      data: [
        {
          patientId: patient.id,
          doctorId: cardiologist,
          startsAt: zonedDateTime(day, 9 * 60, TZ),
          endsAt: zonedDateTime(day, 9 * 60 + 30, TZ),
          reason: "Palpitaciones ocasionales al hacer ejercicio",
          aiSummary:
            "Paciente de 42 años refiere palpitaciones de pocos segundos durante el ejercicio desde hace 3 semanas. Sin dolor torácico ni desmayos. Antecedente familiar de hipertensión.",
          source: "AI_ASSISTANT",
        },
        {
          patientId: patient.id,
          doctorId: doctorIds["dr.herrera@medicita.dev"]!,
          startsAt: zonedDateTime(addDaysToKey(day, 1), 15 * 60, TZ),
          endsAt: zonedDateTime(addDaysToKey(day, 1), 15 * 60 + 30, TZ),
          reason: "Revisión de un lunar en la espalda",
          source: "MANUAL",
        },
      ],
    });
  }

  console.log("Seed completado.");
  console.log(`  Paciente: paciente@medicita.dev / ${PASSWORD}`);
  console.log(`  Médica:   dra.gomez@medicita.dev / ${PASSWORD}`);
  console.log(`  Admin:    admin@medicita.dev / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
