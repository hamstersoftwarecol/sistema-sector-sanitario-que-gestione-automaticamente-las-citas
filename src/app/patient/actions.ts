"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { BookingError, bookAppointment, cancelAppointment } from "@/lib/scheduling/booking";
import { bookingSchema, formValues, type FormState } from "@/lib/validation";

export async function bookAppointmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("PATIENT");
  const values = formValues(formData);
  const parsed = bookingSchema.safeParse({
    doctorId: formData.get("doctorId"),
    startsAt: formData.get("startsAt"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };

  try {
    await bookAppointment({
      patientId: user.id,
      doctorId: parsed.data.doctorId,
      startsAt: new Date(parsed.data.startsAt),
      reason: parsed.data.reason,
      source: "MANUAL",
    });
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message, values };
    throw error;
  }

  revalidatePath("/patient", "layout");
  redirect("/patient/appointments?booked=1");
}

export async function cancelAppointmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("PATIENT");
  const appointmentId = formData.get("appointmentId");
  if (typeof appointmentId !== "string") return { error: "Cita no válida." };

  try {
    await cancelAppointment({ appointmentId, actor: user });
  } catch (error) {
    if (error instanceof BookingError) return { error: error.message };
    throw error;
  }
  revalidatePath("/patient", "layout");
  return { success: "Cita cancelada." };
}
