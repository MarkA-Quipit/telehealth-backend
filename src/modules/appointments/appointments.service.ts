import { db } from "../../config/db";
import { AppError } from "../../shared/types";
import { appointmentsRepository } from "./appointments.repository";
import { patientsRepository } from "../patients/patients.repository";
import { doctorsRepository } from "../doctors/doctors.repository";
import { notificationsService } from "../notifications/notifications.service";
import type { CreateAppointmentInput, UpdateStatusInput, CancelAppointmentInput } from "./appointments.schema";

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------
const DOCTOR_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed"],
  confirmed: ["completed"],
};
const TERMINAL = ["completed", "cancelled"];

// ---------------------------------------------------------------------------
// Date formatter — "June 3, 2026 at 10:00 AM"
// ---------------------------------------------------------------------------
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(date);
}

export const appointmentsService = {
  // ── createAppointment ─────────────────────────────────────────────────────
  async createAppointment(requesterId: string, dto: CreateAppointmentInput) {
    // 1. Resolve patient profile from the requesting user
    const patientProfile = await patientsRepository.findByUserId(requesterId);
    if (!patientProfile) {
      throw new AppError("Only patients can book appointments", 403);
    }

    // 2. Verify doctor exists
    const doctorProfile = await doctorsRepository.findById(dto.doctorId);
    if (!doctorProfile) throw new AppError("Doctor not found", 404);

    // 3. Validate scheduledAt is in the future
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new AppError("Appointment must be scheduled in the future", 400);
    }

    const durationMinutes = dto.durationMinutes ?? 30;

    // 4. Conflict check
    const hasConflict = await appointmentsRepository.checkConflict(
      dto.doctorId,
      scheduledAt,
      durationMinutes,
    );
    if (hasConflict) {
      throw new AppError("This time slot is already booked", 409);
    }

    const endsAt = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

    // 5. Create appointment (in transaction per rules)
    const appointment = await db.transaction(async (tx) => {
      return appointmentsRepository.create(
        {
          patientId: patientProfile.id,
          doctorId: dto.doctorId,
          scheduledAt,
          endsAt,
          reasonForVisit: dto.reasonForVisit,
        },
        tx,
      );
    });

    // 6. Resolve names for notification messages
    const full = await appointmentsRepository.findById(appointment.id);
    if (full) {
      const patientFullName = `${full.patient.firstName} ${full.patient.lastName}`;
      const doctorFullName  = `${full.doctor.firstName} ${full.doctor.lastName}`;
      const formattedDate   = formatDate(scheduledAt);
      const appointmentId   = appointment.id;

      // Notify patient
      notificationsService.createAndPush(
        full.patient.userId,
        "appointment_booked",
        "Appointment Booked",
        `Your appointment with Dr. ${doctorFullName} on ${formattedDate} is pending confirmation.`,
        { appointmentId },
      ).catch((err: unknown) => console.error("[notify] patient booking:", err));

      // Notify doctor
      notificationsService.createAndPush(
        full.doctor.userId,
        "appointment_booked",
        "New Appointment Request",
        `${patientFullName} has booked an appointment on ${formattedDate}.`,
        { appointmentId },
      ).catch((err: unknown) => console.error("[notify] doctor booking:", err));
    }

    return full;
  },

  // ── getAppointment ────────────────────────────────────────────────────────
  async getAppointment(requesterId: string, appointmentId: string) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    // Authorization: requester must be the patient's userId or doctor's userId
    const isPatient = appointment.patient.userId === requesterId;
    const isDoctor = appointment.doctor.userId === requesterId;
    if (!isPatient && !isDoctor) {
      throw new AppError("You do not have access to this appointment", 403);
    }

    return appointment;
  },

  // ── listAppointments ──────────────────────────────────────────────────────
  async listAppointments(
    requesterId: string,
    requesterRoles: string[],
    filters: { status?: string; page?: number; limit?: number },
  ) {
    if (requesterRoles.includes("doctor")) {
      const doctorProfile = await doctorsRepository.findByUserId(requesterId);
      if (!doctorProfile) throw new AppError("Doctor profile not found", 404);
      return appointmentsRepository.findByDoctor(doctorProfile.id, filters);
    }

    // Default: treat as patient
    const patientProfile = await patientsRepository.findByUserId(requesterId);
    if (!patientProfile) throw new AppError("Patient profile not found", 404);
    return appointmentsRepository.findByPatient(patientProfile.id, filters);
  },

  // ── updateStatus — doctor only ────────────────────────────────────────────
  async updateStatus(requesterId: string, appointmentId: string, dto: UpdateStatusInput) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    // Must be the doctor
    if (appointment.doctor.userId !== requesterId) {
      throw new AppError("Only the assigned doctor can update appointment status", 403);
    }

    const current = appointment.status;

    // Terminal states cannot change
    if (TERMINAL.includes(current)) {
      throw new AppError(`Appointment is already ${current} and cannot be changed`, 409);
    }

    // Validate transition
    const allowed = DOCTOR_TRANSITIONS[current] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new AppError(
        `Cannot transition from '${current}' to '${dto.status}'`,
        409,
      );
    }

    const updated = await appointmentsRepository.updateStatus(appointmentId, dto.status);
    const full = await appointmentsRepository.findById(updated.id);

    if (full) {
      const doctorFullName = `${full.doctor.firstName} ${full.doctor.lastName}`;
      const formattedDate  = formatDate(full.scheduledAt);
      const apptId         = full.id;

      if (dto.status === "confirmed") {
        notificationsService.createAndPush(
          full.patient.userId,
          "appointment_confirmed",
          "Appointment Confirmed",
          `Dr. ${doctorFullName} confirmed your appointment on ${formattedDate}.`,
          { appointmentId: apptId },
        ).catch((err: unknown) => console.error("[notify] confirmed:", err));
      }

      if (dto.status === "completed") {
        notificationsService.createAndPush(
          full.patient.userId,
          "appointment_completed",
          "Consultation Complete",
          `Your consultation with Dr. ${doctorFullName} is complete. View your notes and prescriptions.`,
          { appointmentId: apptId },
        ).catch((err: unknown) => console.error("[notify] completed:", err));
      }
    }

    return full;
  },

  // ── cancelAppointment — either role ───────────────────────────────────────
  async cancelAppointment(
    requesterId: string,
    appointmentId: string,
    dto: CancelAppointmentInput,
  ) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    const isPatient = appointment.patient.userId === requesterId;
    const isDoctor = appointment.doctor.userId === requesterId;
    if (!isPatient && !isDoctor) {
      throw new AppError("You do not have access to this appointment", 403);
    }

    const current = appointment.status;

    if (TERMINAL.includes(current)) {
      throw new AppError(`Appointment is already ${current} and cannot be cancelled`, 409);
    }

    if (!["pending", "confirmed"].includes(current)) {
      throw new AppError(`Cannot cancel an appointment with status '${current}'`, 409);
    }

    const updated = await appointmentsRepository.cancel(
      appointmentId,
      requesterId,
      dto.cancellationReason,
    );

    const full = await appointmentsRepository.findById(updated.id);

    if (full) {
      const patientFullName = `${full.patient.firstName} ${full.patient.lastName}`;
      const doctorFullName  = `${full.doctor.firstName} ${full.doctor.lastName}`;
      const formattedDate   = formatDate(full.scheduledAt);
      const apptId          = full.id;

      if (isPatient) {
        // Cancelled by patient → notify doctor
        notificationsService.createAndPush(
          full.doctor.userId,
          "appointment_cancelled",
          "Appointment Cancelled",
          `${patientFullName} cancelled their appointment on ${formattedDate}.`,
          { appointmentId: apptId },
        ).catch((err: unknown) => console.error("[notify] cancel→doctor:", err));
      } else {
        // Cancelled by doctor → notify patient
        notificationsService.createAndPush(
          full.patient.userId,
          "appointment_cancelled",
          "Appointment Cancelled",
          `Dr. ${doctorFullName} cancelled your appointment on ${formattedDate}.`,
          { appointmentId: apptId },
        ).catch((err: unknown) => console.error("[notify] cancel→patient:", err));
      }
    }

    return full;
  },
};
