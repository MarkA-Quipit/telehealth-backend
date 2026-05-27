import { AppError } from "../../shared/types";
import { appointmentsRepository } from "../appointments/appointments.repository";
import { consultationsRepository } from "./consultations.repository";
import type { CreateNoteData } from "./consultations.schema";

export const consultationsService = {
  // ── getNotes ──────────────────────────────────────────────────────────────
  // Validates requester is a participant in the appointment, then returns note
  async getNotes(requesterId: string, appointmentId: string) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    const isParticipant =
      appointment.patient.userId === requesterId ||
      appointment.doctor.userId === requesterId;
    if (!isParticipant) {
      throw new AppError("You do not have access to this appointment", 403);
    }

    return consultationsRepository.findNotesByAppointmentId(appointmentId);
  },

  // ── createOrUpdateNotes ───────────────────────────────────────────────────
  // Doctor only — upsert: update if note exists, insert otherwise
  async createOrUpdateNotes(requesterId: string, appointmentId: string, data: CreateNoteData) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    // Only the assigned doctor may write notes
    if (appointment.doctor.userId !== requesterId) {
      throw new AppError("Only the assigned doctor can write consultation notes", 403);
    }

    const existing = await consultationsRepository.findNotesByAppointmentId(appointmentId);

    if (existing) {
      return consultationsRepository.updateNote(appointmentId, data);
    }

    return consultationsRepository.createNote({
      appointmentId,
      doctorId: appointment.doctor.id,
      patientId: appointment.patient.id,
      ...data,
    });
  },
};
