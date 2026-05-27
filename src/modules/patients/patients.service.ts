import { AppError } from "../../shared/types";
import { patientsRepository } from "./patients.repository";
import type { UpdatePatientInput } from "./patients.schema";

export const patientsService = {
  // ── getPatientProfile — by patient_profiles.id ────────────────────────────
  async getPatientProfile(patientId: string) {
    const patient = await patientsRepository.findById(patientId);
    if (!patient) throw new AppError("Patient not found", 404);
    return patient;
  },

  // ── getPatientProfileByUserId — by users.id ───────────────────────────────
  async getPatientProfileByUserId(userId: string) {
    const patient = await patientsRepository.findByUserId(userId);
    if (!patient) throw new AppError("Patient profile not found", 404);
    return patient;
  },

  // ── updatePatientProfile ──────────────────────────────────────────────────
  async updatePatientProfile(
    requesterId: string,
    patientId: string,
    data: Partial<UpdatePatientInput>,
  ) {
    const patient = await patientsRepository.findById(patientId);
    if (!patient) throw new AppError("Patient not found", 404);

    // Authorization: requester must be the patient's user
    if (patient.userId !== requesterId) {
      throw new AppError("You are not allowed to update this patient profile", 403);
    }

    return patientsRepository.upsert(patient.userId, data);
  },
};