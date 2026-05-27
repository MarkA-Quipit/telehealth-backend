import { AppError } from "../../shared/types";
import { appointmentsRepository } from "../appointments/appointments.repository";
import { doctorsRepository } from "../doctors/doctors.repository";
import { prescriptionsRepository } from "./prescriptions.repository";
import type { CreatePrescriptionInput } from "./prescriptions.schema";

export const prescriptionsService = {
  // ── getPrescriptions ──────────────────────────────────────────────────────
  async getPrescriptions(requesterId: string, appointmentId: string) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    const isParticipant =
      appointment.patient.userId === requesterId ||
      appointment.doctor.userId === requesterId;
    if (!isParticipant) {
      throw new AppError("You do not have access to this appointment", 403);
    }

    return prescriptionsRepository.findByAppointmentId(appointmentId);
  },

  // ── addPrescription — doctor only ─────────────────────────────────────────
  async addPrescription(
    requesterId: string,
    appointmentId: string,
    data: CreatePrescriptionInput,
  ) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    if (appointment.doctor.userId !== requesterId) {
      throw new AppError("Only the assigned doctor can add prescriptions", 403);
    }

    return prescriptionsRepository.create({
      appointmentId,
      doctorId: appointment.doctor.id,
      patientId: appointment.patient.id,
      ...data,
    });
  },

  // ── deletePrescription — doctor only ──────────────────────────────────────
  async deletePrescription(
    requesterId: string,
    appointmentId: string,
    prescriptionId: string,
  ) {
    const appointment = await appointmentsRepository.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    if (appointment.doctor.userId !== requesterId) {
      throw new AppError("Only the assigned doctor can delete prescriptions", 403);
    }

    // Resolve doctor profile id for the ownership check in the repository
    const doctorProfile = await doctorsRepository.findByUserId(requesterId);
    if (!doctorProfile) throw new AppError("Doctor profile not found", 404);

    await prescriptionsRepository.deleteById(prescriptionId, doctorProfile.id);
  },
};
