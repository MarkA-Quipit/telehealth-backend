import { AppError } from "../../shared/types";
import { patientsRepository } from "./patients.repository";
import { uploadDocumentBuffer } from "../../config/cloudinary";
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

  // ── getPatientHistory ─────────────────────────────────────────────────────
  async getPatientHistory(requesterId: string, patientId: string) {
    const patient = await patientsRepository.findById(patientId);
    if (!patient) throw new AppError("Patient not found", 404);

    const { appointments, notesByApptId, rxByApptId } =
      await patientsRepository.getPatientHistory(patientId);

    const consultationHistory = appointments.map((appt) => {
      const note = notesByApptId[appt.id] ?? null;
      const rxList = rxByApptId[appt.id] ?? [];
      return {
        appointmentId: appt.id,
        scheduledAt: appt.scheduledAt,
        notes: note
          ? {
              chiefComplaint: note.chiefComplaint ?? null,
              diagnosis: note.diagnosis ?? null,
              notes: note.notes ?? null,
              followUpDate: note.followUpDate ?? null,
            }
          : null,
        prescriptions: rxList.map((rx) => ({
          id: rx.id,
          medicationName: rx.medicationName,
          dosage: rx.dosage ?? null,
          frequency: rx.frequency ?? null,
          duration: rx.duration ?? null,
          instructions: rx.instructions ?? null,
        })),
      };
    });

    return { patient, consultationHistory };
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

  // ── uploadDocument ────────────────────────────────────────────────────────
  async uploadDocument(
    requesterId: string,
    patientId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    const patient = await patientsRepository.findById(patientId);
    if (!patient) throw new AppError("Patient not found", 404);
    if (patient.userId !== requesterId) throw new AppError("Forbidden", 403);

    const secureUrl = await uploadDocumentBuffer(
      patientId,
      file.originalname,
      file.buffer,
      file.mimetype,
    );

    await patientsRepository.saveDocument(patientId, secureUrl, file.originalname, file.mimetype);
    return patientsRepository.getDocuments(patientId);
  },

  // ── getDocuments ──────────────────────────────────────────────────────────
  async getDocuments(patientId: string) {
    const patient = await patientsRepository.findById(patientId);
    if (!patient) throw new AppError("Patient not found", 404);
    return patientsRepository.getDocuments(patientId);
  },
};